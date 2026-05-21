import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type { MotionBriefWire } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/cinematography/approve (Stage 5.7, v2.0)
 *
 * Body: `CinematographyApproveRequest` — `{ session_id }`. Locks the
 * per-beat motion briefs (sets `cinematography_approved_at = now()`) and
 * advances stage to `video_render` — the Phase 7 (Seedance) entry point.
 *
 * Preconditions: `cinematography_briefs` must be a non-empty array. The
 * state-machine entry tag `video_render` is declared here ahead of Phase 7
 * shipping a stage tag — the legalNextStages PATCH guard treats sequential
 * stage tags loosely; this approve writes the stage column directly so the
 * guard isn't in the path.
 *
 * Returns the updated `SessionWire`.
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

  const briefs = (auth.session.cinematographyBriefs as MotionBriefWire[] | null) ?? null;
  if (!Array.isArray(briefs) || briefs.length === 0) {
    return errJson('no-briefs', { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .update(sessions)
    .set({
      cinematographyApprovedAt: new Date(),
      stage: 'video_render',
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (rows.length === 0) {
    return errJson('session-not-found', { status: 404 });
  }

  return okJson({ session: serializeSession(rows[0]!) });
}
