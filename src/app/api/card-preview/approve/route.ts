import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/card-preview/approve (Stage 5.6, v2.3)
 *
 * Body: `CardPreviewApproveRequest` — `{ session_id }`. Locks the three
 * card-preview frames (sets `card_preview_approved_at = now()`) and
 * advances stage to `cinematography_brief` (Phase 6 entry).
 *
 * Preconditions: `card_preview_asset_ids` must be an array of length 3
 * with no empty entries. Otherwise 400 `incomplete-cards`.
 *
 * Returns the updated `SessionWire` so the client can re-hydrate state.
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

  const cardIds = auth.session.cardPreviewAssetIds ?? null;
  if (
    !cardIds ||
    !Array.isArray(cardIds) ||
    cardIds.length !== 3 ||
    cardIds.some((id) => !id)
  ) {
    return errJson('incomplete-cards', {
      status: 400,
      details: {
        card_count: Array.isArray(cardIds) ? cardIds.length : 0,
      },
    });
  }

  const db = getDb();
  const rows = await db
    .update(sessions)
    .set({
      cardPreviewApprovedAt: new Date(),
      stage: 'cinematography_brief',
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (rows.length === 0) {
    return errJson('session-not-found', { status: 404 });
  }

  return okJson({ session: serializeSession(rows[0]!) });
}
