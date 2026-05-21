import { eq, inArray } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { generateVideo } from '@/lib/ai/generate-video';
import { AIError } from '@/lib/ai/types';
import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type {
  BeatWire,
  MotionBriefWire,
  VideoClipStatus,
  VideoClipWire,
} from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets, sessions } from '@/lib/db/schema';
import { findArtStyle } from '@/lib/library/art-styles';
import { findFormat } from '@/lib/library/formats';
import { findTheme } from '@/lib/library/themes';
import { buildVideoClipPrompt } from '@/lib/prompts/build-video-clip';
import { authBySession } from '@/lib/session/auth';
import { checkSessionBudget } from '@/lib/session/budget';
import { acquireSessionSlot } from '@/lib/session/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/video/render (Stage 6 — Generation)
 *
 * Body: `VideoRenderRequest` — `{ session_id }`. Kicks off all N Seedance 2.0
 * clip renders SEQUENTIALLY — fal rate-limits aggressively on the video
 * endpoint, and the spec's "no clip is ever rendered without an approved
 * brief" rule plus sequential ordering keeps cost predictable. Per-clip
 * cost ≈ $0.50, so an 8-beat tribute is ~$4 and a 16-beat tribute is ~$8.
 *
 * Preconditions (all 400 unless noted):
 *   - `cinematography_approved_at` null → `cinematography-not-approved`
 *   - `cinematography_briefs` array length must equal `beat_sheet.length`
 *   - `storyboard_frame_asset_ids` must be present and non-empty per beat
 *   - format / theme / style / aspect / character-sheet present
 *
 * Process per beat (in idx order):
 *   1. Mark `video_clip_statuses[idx] = 'rendering'` and persist.
 *   2. Build the Seedance prompt via `buildVideoClipPrompt` from the
 *      approved brief + storyboard frame + locked format/theme/style.
 *   3. Call `generateVideo()` (180s timeout, single retry, fal sole vendor).
 *   4. On success: insert `assets` row kind='video_clip' with
 *      `metadata.beat_idx`; write the asset id into
 *      `video_clip_asset_ids[idx]`; mark status 'done'.
 *   5. On failure: mark status 'failed' with `error` message; continue
 *      to the next beat (the user can reroll the failed one later).
 *
 * The route returns the initial clips snapshot AFTER all sequential
 * renders finish — `maxDuration=300` (5 minutes) covers the typical
 * 8-beat ≈ 30–60s/clip path. The frontend uses /api/video/status to
 * poll long-running sessions (16-beat tributes may benefit from a
 * background queue once we add one; Phase 7 keeps it inline).
 *
 * The whole batch shares one `Idempotency-Key` header (the caller sends
 * one for the render-all call). Per-beat sub-keys derive from the batch
 * key so a retry of the same batch dedupes per-beat at the renders table.
 *
 * No vendor names leak through the response — `error` strings on a
 * failed clip are kept generic ("render_failed", "content-policy", or
 * a vendor-neutral message).
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

  const format = findFormat(formatId);
  const theme = findTheme(themeId);
  const style = findArtStyle(styleId);
  if (!format || !theme || !style) {
    return errJson('invalid-input', {
      status: 400,
      details: {
        unknown: {
          format_id: format ? null : formatId,
          theme_id: theme ? null : themeId,
          style_id: style ? null : styleId,
        },
      },
    });
  }

  // -------- budget + in-flight slot --------
  const budget = await checkSessionBudget(sessionId);
  if (!budget.ok) return errJson(budget.reason, { status: 429 });

  const slot = acquireSessionSlot(sessionId);
  if (!slot.ok) {
    if (slot.reason === 'in_flight') {
      return errJson('render-in-flight', { status: 409, headers: { 'Retry-After': '5' } });
    }
    return errJson('session-budget-exceeded', { status: 429 });
  }

  const batchKey = req.headers.get('idempotency-key') ?? uuidv7();
  const sortedBeats = [...beats].sort((a, b) => a.idx - b.idx);
  const briefsByIdx = new Map<number, MotionBriefWire>();
  for (const b of briefs) briefsByIdx.set(b.beat_idx, b);

  let committed = false;
  try {
    const db = getDb();

    // Resolve storyboard frame URLs in one round-trip.
    const frameRows = await db
      .select({
        id: assets.id,
        publicUrl: assets.publicUrl,
        kind: assets.kind,
        sessionId: assets.sessionId,
      })
      .from(assets)
      .where(inArray(assets.id, frameAssetIds));
    const urlByAssetId = new Map<string, string>();
    for (const row of frameRows) {
      if (row.sessionId !== sessionId) continue;
      if (row.kind !== 'storyboard_frame') continue;
      urlByAssetId.set(row.id, row.publicUrl);
    }

    const frameUrls: string[] = new Array(beats.length);
    for (let i = 0; i < beats.length; i++) {
      const url = urlByAssetId.get(frameAssetIds[i]!);
      if (!url) {
        slot.slot.releaseAndDontCount();
        committed = true;
        return errJson('cinematography-not-approved', {
          status: 400,
          details: { reason: 'frame-asset-missing', beat_idx: i },
        });
      }
      frameUrls[i] = url;
    }

    // Initialize status array — all 'queued'. We persist this immediately
    // so even if the route crashes mid-batch, the FE polling /status sees
    // the intent. Any pre-existing asset-id array from a prior failed run
    // is preserved (so reroll can target the failed indices).
    const initialStatuses: VideoClipStatus[] = new Array(beats.length).fill('queued');
    const clipAssetIds: string[] = [
      ...((auth.session.videoClipAssetIds ?? []) as string[]),
    ];
    while (clipAssetIds.length < beats.length) clipAssetIds.push('');

    await db
      .update(sessions)
      .set({
        videoClipStatuses: initialStatuses,
        stage: 'video_render',
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    // -------- sequential render loop --------
    const statuses: VideoClipStatus[] = [...initialStatuses];
    const errors: Array<string | undefined> = new Array(beats.length).fill(undefined);

    for (const beat of sortedBeats) {
      const brief = briefsByIdx.get(beat.idx);
      if (!brief) {
        statuses[beat.idx] = 'failed';
        errors[beat.idx] = 'brief-missing';
        await persistStatuses(sessionId, statuses);
        continue;
      }

      const storyboardFrameUrl = frameUrls[beat.idx]!;

      statuses[beat.idx] = 'rendering';
      errors[beat.idx] = undefined;
      await persistStatuses(sessionId, statuses);

      const { prompt, imageUrl, durationSeconds, aspectRatio: clipAspect } = buildVideoClipPrompt({
        session,
        beat,
        brief,
        format,
        theme,
        style,
        storyboardFrameUrl,
      });

      try {
        const result = await generateVideo({
          imageUrl,
          prompt,
          durationSeconds,
          aspectRatio: clipAspect,
          sessionId,
          idempotencyKey: `${batchKey}:beat-${beat.idx}`,
          stage: 'video_clip',
        });

        const assetId = uuidv7();
        const s3Key = extractS3KeyFromPublicUrl(result.url);

        await db.insert(assets).values({
          id: assetId,
          sessionId,
          kind: 'video_clip',
          source: 'vendor_render',
          r2Key: s3Key,
          publicUrl: result.url,
          mimeType: 'video/mp4',
          metadata: {
            vendor_served: result.vendorServed,
            vendor_attempted: result.vendorAttempted,
            cost_usd_est: result.costUsdEst,
            duration_ms: result.durationMs,
            beat_idx: beat.idx,
            beat_archetype: beat.archetype,
            format_id: format.id,
            theme_id: theme.id,
            style_id: style.id,
            aspect_ratio: clipAspect,
            duration_s: durationSeconds,
          },
        });

        clipAssetIds[beat.idx] = assetId;
        statuses[beat.idx] = 'done';
      } catch (err) {
        if (err instanceof AIError) {
          console.error('[video.render] AIError', {
            beat_idx: beat.idx,
            code: err.code,
            attempts: err.attempts,
          });
          statuses[beat.idx] = 'failed';
          errors[beat.idx] =
            err.code === 'content_policy'
              ? 'content-policy-violation'
              : err.code === 'invalid_input'
                ? 'invalid-input'
                : 'render_failed';
        } else {
          console.error('[video.render] unexpected error', {
            beat_idx: beat.idx,
            error: err instanceof Error ? err.message : String(err),
          });
          statuses[beat.idx] = 'failed';
          errors[beat.idx] = 'render_failed';
        }
      }

      // Persist after every beat so the FE polling /status gets incremental
      // visibility. Asset id array is written too so a reroll of a later
      // beat doesn't blow away an earlier successful one.
      await persistRenderProgress(sessionId, statuses, clipAssetIds);
    }

    slot.slot.commit();
    committed = true;

    const clips: VideoClipWire[] = sortedBeats.map((b) => ({
      beat_idx: b.idx,
      status: statuses[b.idx]!,
      asset_id: statuses[b.idx] === 'done' ? clipAssetIds[b.idx] || null : null,
      public_url: null, // resolved by /status from the asset row
      ...(errors[b.idx] ? { error: errors[b.idx]! } : {}),
    }));

    // Hydrate public_url for done clips so the FE can show the first
    // frame immediately without a /status round-trip.
    const doneAssetIds = clips
      .filter((c) => c.status === 'done' && c.asset_id)
      .map((c) => c.asset_id!);
    if (doneAssetIds.length > 0) {
      const rows = await db
        .select({ id: assets.id, publicUrl: assets.publicUrl })
        .from(assets)
        .where(inArray(assets.id, doneAssetIds));
      const urlById = new Map(rows.map((r) => [r.id, r.publicUrl]));
      for (const c of clips) {
        if (c.status === 'done' && c.asset_id) c.public_url = urlById.get(c.asset_id) ?? null;
      }
    }

    return okJson({ clips });
  } finally {
    if (!committed) slot.slot.releaseAndDontCount();
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function persistStatuses(sessionId: string, statuses: VideoClipStatus[]): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ videoClipStatuses: statuses, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

async function persistRenderProgress(
  sessionId: string,
  statuses: VideoClipStatus[],
  clipAssetIds: string[],
): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({
      videoClipStatuses: statuses,
      videoClipAssetIds: clipAssetIds,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

function extractS3KeyFromPublicUrl(url: string): string {
  const base = (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  if (base && url.startsWith(base + '/')) {
    return url.slice(base.length + 1);
  }
  console.warn('[video.render] S3 public URL did not match S3_PUBLIC_BASE_URL prefix', {
    url,
    base,
  });
  const idx = url.indexOf('/sessions/');
  if (idx >= 0) return url.slice(idx + 1);
  return url;
}

