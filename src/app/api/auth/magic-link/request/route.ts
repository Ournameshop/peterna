import { errJson, okJson } from '@/lib/api/respond';
import { sendMagicLinkEmail } from '@/lib/auth/email';
import { generateMagicLinkToken, normalizeEmail } from '@/lib/auth/magic-link';
import { consumePerEmail } from '@/lib/auth/rate-limit';
import { publicBaseUrl } from '@/lib/delivery/slug';
import { isLikelyEmail } from '@/lib/delivery/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/magic-link/request (Phase 10)
 *
 * Body: `MagicLinkRequestRequest` — `{ email: string }`.
 *
 * Behavior:
 *   - Validates the email shape via `isLikelyEmail`.
 *   - Per-email rate limit: 3 / 15 min. Hits return `{ ok: false, error: 'rate-limited' }`.
 *   - Always returns `{ ok: true, sent: true }` whether the email maps to an
 *     existing user or not — this is the standard enumeration-proof pattern.
 *   - If Brevo send fails, we log but still return `ok=true` for the same
 *     reason: a 5xx differential would leak existence info to an attacker.
 *     Ops sees the failure in logs; a legitimate user retries.
 *
 * The signin URL points at `/auth/callback?token=<raw>` — that page is the
 * frontend agent's responsibility (it hits `/api/auth/magic-link/consume`
 * and then redirects).
 */
export async function POST(req: Request): Promise<Response> {
  let body: { email?: unknown };
  try {
    body = (await req.json()) as { email?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }
  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  if (!isLikelyEmail(emailRaw)) {
    return errJson('invalid-input', { status: 400, details: { field: 'email' } });
  }
  const email = normalizeEmail(emailRaw);

  const rate = consumePerEmail(email);
  if (!rate.ok) {
    return errJson('rate-limited', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) },
    });
  }

  // Token + email happen in sequence — if the send fails, the token stays in
  // the DB until it expires (it's only useful with the raw value, which only
  // ever existed in this process's memory).
  const { rawToken } = await generateMagicLinkToken(email);
  const signinUrl = `${publicBaseUrl()}/auth/callback?token=${encodeURIComponent(rawToken)}`;

  const sendResult = await sendMagicLinkEmail({ to: email, signinUrl });
  if (!sendResult.ok) {
    // Log but DO NOT surface — enumeration-safe envelope.
    console.warn('[auth.magic-link.request] send failed', {
      reason: sendResult.error,
      details: sendResult.details,
    });
  }

  return okJson({ sent: true });
}
