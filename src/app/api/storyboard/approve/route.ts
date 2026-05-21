import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type { BeatWire } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/storyboard/approve
 *
 * Body: `StoryboardApproveRequest` — `{ session_id }`. Locks the N-frame
 * storyboard (sets `storyboard_approved_at = now()`) and advances stage to
 * `words_render` (Phase 5 entry).
 *
 * Preconditions: `storyboard_frame_asset_ids` must be non-null AND its length
 * must equal `beat_count`, and no entry may be empty. Otherwise 400
 * `incomplete-storyboard`.
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

  const beats = (auth.session.beatSheet as BeatWire[] | null) ?? null;
  const beatCount = Array.isArray(beats) ? beats.length : 0;
  const frameIds = auth.session.storyboardFrameAssetIds ?? null;

  if (
    !frameIds ||
    !Array.isArray(frameIds) ||
    frameIds.length !== beatCount ||
    beatCount === 0 ||
    frameIds.some((id) => !id)
  ) {
    return errJson('incomplete-storyboard', {
      status: 400,
      details: {
        beat_count: beatCount,
        frame_count: Array.isArray(frameIds) ? frameIds.length : 0,
      },
    });
  }

  const db = getDb();
  const updated = await db
    .update(sessions)
    .set({
      storyboardApprovedAt: new Date(),
      stage: 'words_render',
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (updated.length === 0) {
    return errJson('session-not-found', { status: 404 });
  }

  return okJson({ session: serializeSession(updated[0]!) });
}
