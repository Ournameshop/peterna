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
 * POST /api/assembly/approve (Stage 7 — Assembly)
 *
 * Body: `AssemblyApproveRequest` — `{ session_id }`. Sets
 * `video_approved_at = now()` and advances stage to `assembly_complete` —
 * the Stage 7 → 8 hand-off panel. From there the user taps "See the
 * eulogy" which fires `eulogy_render_started` and lands on `eulogy_render`.
 *
 * Preconditions: `assembled_video_asset_id` must be set on the session
 * (i.e. `/api/assembly/render` already produced the final cut). Returns
 * 400 `no-video` if not.
 *
 * Same write pattern as `/api/cinematography/approve` — writes the stage
 * column directly. The state-machine PATCH guard treats forward stage
 * transitions through the state-machine as the validated path; this
 * route is the trusted server-side transition and writes the new stage
 * verbatim.
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

  if (!auth.session.assembledVideoAssetId) {
    return errJson('no-video', { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .update(sessions)
    .set({
      videoApprovedAt: new Date(),
      stage: 'assembly_complete',
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (rows.length === 0) {
    return errJson('session-not-found', { status: 404 });
  }

  return okJson({ session: serializeSession(rows[0]!) });
}
