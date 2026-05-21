import 'server-only';

/**
 * In-memory per-session rate limiting for vendor-touching capabilities. Phase 1 only — Phase 2
 * will move this to Redis. Two constraints enforced here (from `api-routes.md`):
 *   - 1 in-flight render per session
 *   - 20 renders / hour per session
 *
 * The module also exposes a simple per-IP middleware-style helper (60 req/min across all
 * `/api/*`). Phase 1 wires `consumePerIp` from a real `src/middleware.ts` (Bug-2) — the
 * legacy "per-route call at the top" path is still supported for future bespoke handlers.
 *
 * Caveat: in-memory state is per-process. On Vercel-style multi-instance hosting these limits
 * are best-effort. Hard budget enforcement happens at the DB level (renders cost cap, sessions
 * row) and at the cookie boundary.
 *
 * Bug-3: a periodic reaper drops entries whose hour-window has expired AND have no in-flight
 * work, so a long-lived Node process doesn't grow the map unboundedly. Same for the IP map.
 * Bug-9: `acquireSessionSlot` no longer pre-counts the call against the hourly cap; the slot
 * commits the count via the returned `commit()` only after the vendor actually succeeded.
 * Callers that bail out before vendor work should use `releaseAndDontCount()`.
 */

const HOUR_MS = 60 * 60 * 1000;
const RENDERS_PER_HOUR = 20;
const PER_IP_WINDOW_MS = 60 * 1000;
const PER_IP_LIMIT = 60;
const REAP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — cheap; bounded growth between restarts.

type SessionState = {
  inFlight: number;
  windowStart: number;
  count: number;
};

const sessions = new Map<string, SessionState>();

export type SessionSlot = {
  /** Release the in-flight token AND record this call against the hourly cap. */
  commit: () => void;
  /** Release the in-flight token but do NOT count the call (Bug-9). */
  releaseAndDontCount: () => void;
};

export type AcquireResult =
  | { ok: true; slot: SessionSlot; /** Deprecated: equivalent to `slot.commit()`. */ release: () => void }
  | { ok: false; reason: 'in_flight' | 'hourly_cap' };

/**
 * Acquire a slot for a vendor call on this session. The returned slot must either
 * `commit()` (on success) or `releaseAndDontCount()` (on early bailout) — see Bug-9.
 *
 * `release()` is kept as a back-compat alias for `commit()` so older callers don't break.
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
  sessions.set(sessionId, state);

  let settled = false;
  const slot: SessionSlot = {
    commit: () => {
      if (settled) return;
      settled = true;
      const s = sessions.get(sessionId);
      if (!s) return;
      s.inFlight = Math.max(0, s.inFlight - 1);
      s.count += 1;
      sessions.set(sessionId, s);
    },
    releaseAndDontCount: () => {
      if (settled) return;
      settled = true;
      const s = sessions.get(sessionId);
      if (!s) return;
      s.inFlight = Math.max(0, s.inFlight - 1);
      sessions.set(sessionId, s);
    },
  };

  return { ok: true, slot, release: slot.commit };
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

// -----------------------------------------------------------------------------
// Bug-3: reaper — drop stale entries so the map doesn't grow unboundedly.
// -----------------------------------------------------------------------------

function reapStaleEntries(now: number = Date.now()): void {
  for (const [k, v] of sessions) {
    if (v.inFlight === 0 && now - v.windowStart >= HOUR_MS) {
      sessions.delete(k);
    }
  }
  for (const [k, v] of ips) {
    if (now - v.windowStart >= PER_IP_WINDOW_MS * 2) {
      ips.delete(k);
    }
  }
}

// Schedule once per process lifetime. Guarded so tests / re-imports don't double-schedule.
type GlobalWithReaper = typeof globalThis & { __peternaRateReaperStarted?: boolean };
const g = globalThis as GlobalWithReaper;
if (!g.__peternaRateReaperStarted && typeof setInterval === 'function') {
  g.__peternaRateReaperStarted = true;
  const handle = setInterval(() => reapStaleEntries(), REAP_INTERVAL_MS);
  // Don't keep the event loop alive for a janitor task.
  (handle as { unref?: () => void }).unref?.();
}

/** Test-only export so unit tests can trigger reaping deterministically. */
export const __test = { reapStaleEntries, sessions, ips };
