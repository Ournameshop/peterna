import { NextResponse, type NextRequest } from 'next/server';

import { consumePerIp, extractClientIp } from '@/lib/session/rate-limit';

/**
 * Bug-2: per-IP rate limit proxy.
 *
 * Spec at `docs/tribute-builder/api-routes.md`: "Per-IP (middleware): 60 req/min across all
 * `/api/*` routes." The `consumePerIp` helper existed but was never invoked. This file
 * runs on every `/api/*` request, extracts the client IP from the standard forwarding
 * headers, and returns 429 with a `Retry-After` header if the per-IP budget is exhausted.
 *
 * Next 16 renamed the `middleware.ts` file convention to `proxy.ts` (same shape; same
 * runtime constraints). The exported function name is `proxy`.
 *
 * Caveat: on Vercel-style multi-instance hosting these limits are per-process. Hard cost
 * enforcement lives at the DB (renders cost cap) and the per-session slot lock; this is the
 * cheap first line of defence.
 */
export function proxy(req: NextRequest): NextResponse {
  const ip = extractClientIp(req.headers);
  const result = consumePerIp(ip);
  if (!result.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    return NextResponse.json(
      { ok: false, error: 'rate-limited' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      },
    );
  }
  return NextResponse.next();
}

// Only run on `/api/*`. Static assets and pages don't need the per-IP cap.
export const config = {
  matcher: ['/api/:path*'],
};
