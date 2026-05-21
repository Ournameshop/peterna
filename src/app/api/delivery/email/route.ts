import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { isLikelyEmail, sendDeliveryEmail } from '@/lib/delivery/mailer';
import { shareUrlForSlug } from '@/lib/delivery/slug';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/delivery/email (Phase 9 — Final Delivery)
 *
 * Body: `DeliveryEmailRequest` — `{ session_id, email }`.
 *
 * Preconditions:
 *   - `delivery_share_slug` must be set (i.e. /api/delivery/finalize already
 *     ran). 400 `invalid-input` with `reason: 'not-finalized'` otherwise.
 *   - `pet_name` must be set so the subject line makes sense.
 *
 * Effects:
 *   - Sends the "your tribute is ready" email via Brevo transactional API.
 *   - On success, persists `delivery_emailed_to = <email>` on the session.
 *   - Re-sends are allowed (the spec doesn't prohibit them; a family member
 *     forwarding the link to themselves is a real flow).
 *
 * The mailer wrapper handles all the Brevo specifics; the route only
 * cares about envelope shape + DB persistence.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { session_id?: unknown; email?: unknown };
  try {
    body = (await req.json()) as { session_id?: unknown; email?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }
  const sessionId = body.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!isLikelyEmail(email)) {
    return errJson('invalid-input', { status: 400, details: { field: 'email' } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const session = auth.session;

  if (!session.deliveryShareSlug) {
    return errJson('invalid-input', {
      status: 400,
      details: { reason: 'not-finalized' },
    });
  }
  if (!session.petName) {
    return errJson('invalid-input', {
      status: 400,
      details: { reason: 'no-pet-name' },
    });
  }

  const shareUrl = shareUrlForSlug(session.deliveryShareSlug);
  const result = await sendDeliveryEmail({
    to: email,
    petName: session.petName,
    shareUrl,
  });

  if (!result.ok) {
    if (result.error === 'mailer-not-configured') {
      // 503 — the service is structurally unavailable in this environment.
      // We log so a dev who hasn't set BREVO_API_KEY locally gets a clear
      // signal without us bricking the build.
      console.warn('[delivery.email] mailer not configured', {
        session_id: sessionId,
      });
      return errJson('send_failed', {
        status: 503,
        details: { reason: 'mailer-not-configured' },
      });
    }
    console.error('[delivery.email] send failed', {
      session_id: sessionId,
      details: result.details,
    });
    return errJson('send_failed', { status: 502 });
  }

  const db = getDb();
  await db
    .update(sessions)
    .set({
      deliveryEmailedTo: email,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));

  return okJson({ sent_to: email });
}
