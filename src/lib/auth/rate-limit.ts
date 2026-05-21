import 'server-only';

/**
 * Per-email rate limit for `/api/auth/magic-link/request`. Caps the abuse
 * vector where someone hammers the request endpoint to flood a target inbox
 * (or to burn through Brevo's monthly send quota).
 *
 * Policy: 3 requests / 15 minutes / normalized email.
 *
 * In-memory Map, mirroring `src/lib/session/rate-limit.ts`. Same caveats:
 * per-process, multi-instance hosting weakens the cap but it's still a
 * useful first line of defense. A future Redis move would slot in by
 * swapping these two functions.
 *
 * A 5-minute reaper drops stale entries so a long-lived Node process
 * doesn't grow the map unboundedly.
 */

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 3;
const REAP_INTERVAL_MS = 5 * 60 * 1000;

type EmailState = {
  windowStart: number;
  count: number;
};

const emails = new Map<string, EmailState>();

export type EmailRateResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

/**
 * Count an attempt against the per-email window. Returns `{ ok: false }` if
 * this attempt would exceed the cap; otherwise increments and returns
 * `{ ok: true }`. Callers should pass the *normalized* (lowercased) email so
 * `Foo@Bar.com` and `foo@bar.com` share the same bucket.
 */
export function consumePerEmail(emailKey: string): EmailRateResult {
  const now = Date.now();
  const state = emails.get(emailKey) ?? { windowStart: now, count: 0 };
  if (now - state.windowStart >= WINDOW_MS) {
    state.windowStart = now;
    state.count = 0;
  }
  if (state.count >= LIMIT) {
    emails.set(emailKey, state);
    return {
      ok: false,
      retryAfterMs: WINDOW_MS - (now - state.windowStart),
    };
  }
  state.count += 1;
  emails.set(emailKey, state);
  return { ok: true };
}

function reapStale(now: number = Date.now()): void {
  for (const [k, v] of emails) {
    if (now - v.windowStart >= WINDOW_MS * 2) {
      emails.delete(k);
    }
  }
}

type GlobalWithReaper = typeof globalThis & {
  __peternaAuthRateReaperStarted?: boolean;
};
const g = globalThis as GlobalWithReaper;
if (!g.__peternaAuthRateReaperStarted && typeof setInterval === 'function') {
  g.__peternaAuthRateReaperStarted = true;
  const handle = setInterval(() => reapStale(), REAP_INTERVAL_MS);
  (handle as { unref?: () => void }).unref?.();
}

/** Test-only export for deterministic reaper tests. */
export const __test = { reapStale, emails };
