import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { generateDeliverySlug, shareUrlForSlug } from '@/lib/delivery/slug';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/delivery/finalize (Phase 9 — Final Delivery)
 *
 * Body: `DeliveryFinalizeRequest` — `{ session_id }`.
 *
 * Preconditions:
 *   - `assembled_video_asset_id` AND `eulogy_pdf_asset_id` both set.
 *
 * Effects (idempotent):
 *   - If `delivery_share_slug` already set, return the existing slug + URL.
 *   - Otherwise mint a fresh slug, persist it, stamp `delivery_ready_at = now()`.
 *
 * The slug IS the auth for the public delivery page — same posture as the
 * resume tokens. We treat it as unguessable rather than as a secret: it
 * gets emailed, copy-pasted, sent over chat; if someone receives the link
 * they're allowed to see the artifacts.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { session_id?: unknown };
  try {
    body = (await req.json()) as { session_id?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }
  const sessionId = body.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const session = auth.session;

  if (!session.assembledVideoAssetId || !session.eulogyPdfAssetId) {
    return errJson('incomplete-tribute', {
      status: 400,
      details: {
        has_assembled_video: Boolean(session.assembledVideoAssetId),
        has_eulogy_pdf: Boolean(session.eulogyPdfAssetId),
      },
    });
  }

  // Idempotent: re-running finalize returns the existing slug rather than
  // generating a new one. We don't rotate the slug — that would break any
  // link the user already shared.
  if (session.deliveryShareSlug) {
    return okJson({
      share_slug: session.deliveryShareSlug,
      share_url: shareUrlForSlug(session.deliveryShareSlug),
    });
  }

  const db = getDb();
  const slug = generateDeliverySlug();
  const now = new Date();

  await db
    .update(sessions)
    .set({
      deliveryShareSlug: slug,
      deliveryReadyAt: now,
      updatedAt: now,
    })
    .where(eq(sessions.id, sessionId));

  return okJson({
    share_slug: slug,
    share_url: shareUrlForSlug(slug),
  });
}
