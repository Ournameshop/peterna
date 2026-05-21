import 'server-only';

/**
 * In-memory per-session rate limiting for vendor-touching capabilities. Phase 1 only — Phase 2
 * will move this to Redis. Two constraints enforced here (from `api-routes.md`):
 *   - 1 in-flight render per session
 *   - 20 renders / hour per session
 *
 * The module also exposes a simple per-IP middleware-style helper (60 req/min across all
 * `/api/*`). We don't ship Next.js middleware in Phase 1 (the orchestrator wants to keep the
 * blast radius small for the worktree); routes can call `consumePerIp(req)` at the top.
 *
 * Caveat: in-memory state is per-process. On Vercel-style multi-instance hosting these limits
 * are best-effort. Hard budget enforcement happens at the DB level (renders cost cap, sessions
 * row) and at the cookie boundary.
 */

const HOUR_MS = 60 * 60 * 1000;
const RENDERS_PER_HOUR = 20;
const PER_IP_WINDOW_MS = 60 * 1000;
const PER_IP_LIMIT = 60;

type SessionState = {
  inFlight: number;
  windowStart: number;
  count: number;
};

const sessions = new Map<string, SessionState>();

export type AcquireResult =
  | { ok: true; release: () => void }
  | { ok: false; reason: 'in_flight' | 'hourly_cap' };

/**
 * Acquire a slot for a vendor call on this session. The returned `release()` must be called
 * by the caller in a `finally` block so the in-flight counter doesn't leak.
 */
export function acquireSessionSlot(sessionId: string): AcquireResult {
  const now = Date.now();
  const state = sessions.get(sessionId) ?? { inFlight: 0, windowStart: now, count: 0 };

  if (now - state.windowStart >= HOUR_MS) {
    state.windowStart = now;
    state.count = 0;
  }

  if (state.inFlight >= 1) {
    sessions.set(sessionId, state);
    return { ok: false, reason: 'in_flight' };
  }
  if (state.count >= RENDERS_PER_HOUR) {
    sessions.set(sessionId, state);
    return { ok: false, reason: 'hourly_cap' };
  }

  state.inFlight += 1;
  state.count += 1;
  sessions.set(sessionId, state);

  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      const s = sessions.get(sessionId);
      if (!s) return;
      s.inFlight = Math.max(0, s.inFlight - 1);
      sessions.set(sessionId, s);
    },
  };
}

type IpState = { windowStart: number; count: number };
const ips = new Map<string, IpState>();

export type PerIpResult = { ok: true } | { ok: false; retryAfterMs: number };

/**
 * Per-IP across-all-/api/* rate check. Callers pass the resolved IP string (usually
 * `request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()` falling back to `'unknown'`).
 */
export function consumePerIp(ip: string): PerIpResult {
  const now = Date.now();
  const state = ips.get(ip) ?? { windowStart: now, count: 0 };
  if (now - state.windowStart >= PER_IP_WINDOW_MS) {
    state.windowStart = now;
    state.count = 0;
  }
  state.count += 1;
  ips.set(ip, state);
  if (state.count > PER_IP_LIMIT) {
    return { ok: false, retryAfterMs: PER_IP_WINDOW_MS - (now - state.windowStart) };
  }
  return { ok: true };
}

/** Extract the client IP from a Next/Web Request, defaulting to `'unknown'`. */
export function extractClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xreal = headers.get('x-real-ip');
  if (xreal) return xreal;
  return 'unknown';
}
