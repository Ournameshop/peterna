import { and, eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import { getDb } from '@/lib/db/client';
import { assets, sessions } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * POST /api/preview/approve
 *
 * Body: `PreviewApproveRequest` (snake_case) — `{ session_id, asset_id }`.
 *
 * Validates that the asset:
 *   - exists
 *   - belongs to the session (the FK already cascades; defensive double-check so a malicious
 *     `asset_id` from another session can't be locked here)
 *   - has `kind = 'combination_preview'` (defends against approving a `pet_photo` or stale
 *     `character_sheet` asset)
 *
 * On success: sets `sessions.combination_preview_asset_id = <asset_id>` and advances `stage` to
 * `stage_3_complete`. This is the *canonical writer* for that column — the PATCH route's
 * allowlist still permits writing it defensively (per Phase 3 task brief), but the legitimate
 * path is this approve.
 *
 * Returns the updated `SessionWire` so the client can drop the new state straight into the
 * builder context without a follow-up GET.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { session_id?: unknown; asset_id?: unknown };
  try {
    body = (await req.json()) as { session_id?: unknown; asset_id?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }
  const sessionId = body.session_id;
  const assetId = body.asset_id;

  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }
  if (typeof assetId !== 'string' || !assetId) {
    return errJson('invalid-input', { status: 400, details: { field: 'asset_id' } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const db = getDb();

  const rows = await db
    .select({ id: assets.id, kind: assets.kind })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.sessionId, sessionId)))
    .limit(1);
  const asset = rows[0];
  if (!asset) return errJson('asset-not-found', { status: 404 });
  if (asset.kind !== 'combination_preview') {
    return errJson('asset-wrong-kind', { status: 400, details: { kind: asset.kind } });
  }

  const updated = await db
    .update(sessions)
    .set({
      combinationPreviewAssetId: assetId,
      stage: 'stage_3_complete',
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  const row = updated[0];
  if (!row) return errJson('session-not-found', { status: 404 });

  return okJson({ session: serializeSession(row) });
}
