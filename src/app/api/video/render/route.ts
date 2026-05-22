import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type {
  BeatWire,
  MotionBriefWire,
  VideoClipStatus,
  VideoClipWire,
} from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { findArtStyle } from '@/lib/library/art-styles';
import { findFormat } from '@/lib/library/formats';
import { findTheme } from '@/lib/library/themes';
import { enqueueVideoBatch } from '@/lib/queue/enqueue';
import { authBySession } from '@/lib/session/auth';
import { checkSessionBudget } from '@/lib/session/budget';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/video/render (Phase 12 — async)
 *
 * Body: `VideoRenderRequest` — `{ session_id }`. Replaces the Phase 7 inline
 * loop with an enqueue + return-immediately flow:
 *
 *   1. Validate preconditions (same as before — cinematography approved,
 *      briefs/frames present, library refs resolvable).
 *   2. Mark every beat's `video_clip_statuses[i]='queued'` so the FE polling
 *      `/api/video/status` sees the intent immediately.
 *   3. Enqueue one `video_clip` `render_jobs` row per beat + one `assembly`
 *      row that the worker auto-defers until all clips finish.
 *   4. Return the queued clip snapshot — no vendor work happens in this
 *      request lifecycle anymore.
 *
 * Idempotency (B1 in pre-Phase-15 audit): the client sends a stable
 * `Idempotency-Key` derived from the render intent. The server reads it for
 * traceability (logged below) and `enqueueVideoBatch` makes the
 * SELECT-then-INSERT atomic via a Postgres advisory lock keyed by
 * sessionId — see `src/lib/queue/enqueue.ts` for the race-fix details.
 * Two near-simultaneous render kickoffs for the same session now serialize
 * inside that lock, so the second one sees the first one's freshly-
 * inserted clip rows and dedupes against them. Reroll (a separate route)
 * handles re-rendering a specific failed beat.
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

  // Surface the client's Idempotency-Key in logs so duplicate-kickoff
  // forensics are possible after the fact (the advisory lock prevents the
  // duplicate fan-out, but knowing two requests carried the same key helps
  // distinguish "client double-fired" from "two different intents arrived
  // back-to-back").
  const idempotencyKey = req.headers.get('Idempotency-Key')?.trim() || null;

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const session = serializeSession(auth.session);

  // -------- preconditions --------
  if (!session.cinematography_approved_at) {
    return errJson('cinematography-not-approved', { status: 400 });
  }
  const beats = (session.beat_sheet ?? []) as BeatWire[];
  if (!Array.isArray(beats) || beats.length === 0) {
    return errJson('cinematography-not-approved', {
      status: 400,
      details: { reason: 'no-beats' },
    });
  }
  const briefs = (session.cinematography_briefs ?? []) as MotionBriefWire[];
  if (briefs.length !== beats.length) {
    return errJson('cinematography-not-approved', {
      status: 400,
      details: { briefs: briefs.length, beats: beats.length },
    });
  }

  const formatId = session.format_id;
  const themeId = session.theme_id;
  const styleId = session.style_id;
  const aspectRatio = session.aspect_ratio;
  const frameAssetIds = session.storyboard_frame_asset_ids ?? null;
  if (
    !formatId ||
    !themeId ||
    !styleId ||
    !aspectRatio ||
    !frameAssetIds ||
    frameAssetIds.length !== beats.length ||
    frameAssetIds.some((id) => !id)
  ) {
    return errJson('cinematography-not-approved', {
      status: 400,
      details: { reason: 'incomplete-prerequisites' },
    });
  }

  if (!findFormat(formatId) || !findTheme(themeId) || !findArtStyle(styleId)) {
    return errJson('invalid-input', {
      status: 400,
      details: { reason: 'unknown-library-ref' },
    });
  }

  // -------- budget --------
  const budget = await checkSessionBudget(sessionId);
  if (!budget.ok) return errJson(budget.reason, { status: 429 });

  // -------- enqueue --------
  const db = getDb();
  const sortedBeats = [...beats].sort((a, b) => a.idx - b.idx);

  // Reset clip statuses to 'queued' for every beat we're about to enqueue.
  // Preserve the existing asset-id array (so an already-done beat keeps its
  // asset_id; the idempotent enqueue keeps the worker from re-rendering).
  const initialStatuses: VideoClipStatus[] = sortedBeats.map(() => 'queued');
  const clipAssetIds: string[] = [
    ...((auth.session.videoClipAssetIds ?? []) as string[]),
  ];
  while (clipAssetIds.length < beats.length) clipAssetIds.push('');

  await db
    .update(sessions)
    .set({
      videoClipStatuses: initialStatuses,
      videoClipAssetIds: clipAssetIds,
      stage: 'video_render',
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));

  if (idempotencyKey) {
    console.log('[video.render] kickoff', { sessionId, beats: sortedBeats.length, idempotencyKey });
  }

  await enqueueVideoBatch({
    sessionId,
    beatIndices: sortedBeats.map((b) => b.idx),
  });

  const clips: VideoClipWire[] = sortedBeats.map((b) => ({
    beat_idx: b.idx,
    status: 'queued' as VideoClipStatus,
    asset_id: null,
    public_url: null,
  }));

  return okJson({ clips });
}
