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
 * POST /api/beat-sheet/approve
 *
 * Body: `BeatSheetApproveRequest` — `{ session_id }`. Locks the beat sheet
 * (sets `beat_sheet_approved_at = now()`) and advances stage to
 * `storyboard_render` for Phase 4b.
 *
 * Returns the updated SessionWire so the client can re-hydrate state.
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

  if (!auth.session.beatSheet || !Array.isArray(auth.session.beatSheet)) {
    return errJson('no-beats', { status: 400 });
  }

  const db = getDb();
  const updated = await db
    .update(sessions)
    .set({
      beatSheetApprovedAt: new Date(),
      stage: 'storyboard_render',
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (updated.length === 0) {
    return errJson('session-not-found', { status: 404 });
  }

  return okJson({ session: serializeSession(updated[0]!) });
}
