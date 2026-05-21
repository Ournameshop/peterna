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
import { normalizeAspect } from '@/lib/prompts/build-preview';
import { buildVideoClipPrompt } from '@/lib/prompts/build-video-clip';
import { authBySession } from '@/lib/session/auth';
import { checkSessionBudget } from '@/lib/session/budget';
import { acquireSessionSlot } from '@/lib/session/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * POST /api/video/reroll
 *
 * Body: `VideoRerollRequest` — `{ session_id, beat_idx }`. Re-renders a
 * single failed or user-rejected clip. Same pattern as `storyboard/reroll`:
 *   - inserts a NEW `assets` row (never overwrites — preserves cost audit
 *     trail), then splices the new asset id into
 *     `video_clip_asset_ids[beat_idx]` and flips
 *     `video_clip_statuses[beat_idx]` to 'done' (or 'failed' on vendor
 *     failure).
 *   - one render slot + budget check up-front, mirroring `/render`.
 *   - `Idempotency-Key` is per-beat (UI sends one key per reroll click).
 *
 * Preconditions:
 *   - cinematography approved (sessions.cinematography_approved_at set)
 *   - the beat exists in beat_sheet AND has an approved motion brief
 *   - the storyboard frame for this beat exists
 */
export async function POST(req: Request): Promise<Response> {
  let body: { session_id?: unknown; beat_idx?: unknown };
  try {
    body = (await req.json()) as { session_id?: unknown; beat_idx?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }

  const sessionId = body.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }
  const beatIdx = body.beat_idx;
  if (typeof beatIdx !== 'number' || !Number.isInteger(beatIdx) || beatIdx < 0) {
    return errJson('invalid-input', { status: 400, details: { field: 'beat_idx' } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const session = serializeSession(auth.session);

  if (!session.cinematography_approved_at) {
    return errJson('invalid-input', { status: 400, details: { reason: 'cinematography-not-approved' } });
  }

  const beats = (session.beat_sheet ?? []) as BeatWire[];
  const beat = beats.find((b) => b.idx === beatIdx);
  if (!beat) {
    return errJson('beat-not-found', { status: 404, details: { beat_idx: beatIdx } });
  }

  const briefs = (session.cinematography_briefs ?? []) as MotionBriefWire[];
  const brief = briefs.find((b) => b.beat_idx === beatIdx);
  if (!brief) {
    return errJson('beat-not-found', {
      status: 404,
      details: { beat_idx: beatIdx, reason: 'brief-missing' },
    });
  }

  const formatId = session.format_id;
  const themeId = session.theme_id;
  const styleId = session.style_id;
  const aspectRatio = session.aspect_ratio;
  const frameAssetIds = session.storyboard_frame_asset_ids ?? [];
  const storyboardFrameAssetId = frameAssetIds[beatIdx];
  if (!formatId || !themeId || !styleId || !aspectRatio || !storyboardFrameAssetId) {
    return errJson('invalid-input', { status: 400, details: { reason: 'incomplete-prerequisites' } });
  }

  const format = findFormat(formatId);
  const theme = findTheme(themeId);
  const style = findArtStyle(styleId);
  if (!format || !theme || !style) {
    return errJson('invalid-input', { status: 400 });
  }

  const budget = await checkSessionBudget(sessionId);
  if (!budget.ok) return errJson(budget.reason, { status: 429 });

  const slot = acquireSessionSlot(sessionId);
  if (!slot.ok) {
    if (slot.reason === 'in_flight') {
      return errJson('render-in-flight', { status: 409, headers: { 'Retry-After': '5' } });
    }
    return errJson('invalid-input', { status: 429, details: { reason: 'hourly-cap' } });
  }

  const idempotencyKey = req.headers.get('idempotency-key') ?? uuidv7();

  let committed = false;
  try {
    const db = getDb();

    // Resolve storyboard frame URL.
    const frameRows = await db
      .select({ url: assets.publicUrl, kind: assets.kind, sessionId: assets.sessionId })
      .from(assets)
      .where(inArray(assets.id, [storyboardFrameAssetId]))
      .limit(1);
    const frameRow = frameRows[0];
    if (
      !frameRow ||
      frameRow.sessionId !== sessionId ||
      frameRow.kind !== 'storyboard_frame'
    ) {
      slot.slot.releaseAndDontCount();
      committed = true;
      return errJson('invalid-input', {
        status: 400,
        details: { reason: 'storyboard-frame-not-found' },
      });
    }

    const aspect = normalizeAspect(aspectRatio);
    const { prompt, imageUrl, durationSeconds } = buildVideoClipPrompt({
      session,
      beat,
      brief,
      format,
      theme,
      style,
      storyboardFrameUrl: frameRow.url,
    });

    // Flip status to 'rendering' before the vendor call so a concurrent
    // /status poll sees the work in progress.
    const statuses = await readStatuses(sessionId, beats.length);
    statuses[beatIdx] = 'rendering';
    await persistStatuses(sessionId, statuses);

    let result;
    try {
      result = await generateVideo({
        imageUrl,
        prompt,
        durationSeconds,
        aspectRatio: aspect,
        sessionId,
        idempotencyKey,
        stage: 'video_clip',
      });
    } catch (err) {
      slot.slot.commit();
      committed = true;

      const errorTag =
        err instanceof AIError
          ? err.code === 'content_policy'
            ? 'content-policy-violation'
            : err.code === 'invalid_input'
              ? 'invalid-input'
              : 'render_failed'
          : 'render_failed';

      console.error('[video.reroll] vendor failure', {
        beat_idx: beatIdx,
        error: err instanceof Error ? err.message : String(err),
      });

      statuses[beatIdx] = 'failed';
      await persistStatuses(sessionId, statuses);

      const clip: VideoClipWire = {
        beat_idx: beatIdx,
        status: 'failed',
        asset_id: null,
        public_url: null,
        error: errorTag,
      };
      return Response.json({ ok: true, ...clip }, { status: 200 });
    }

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
        beat_idx: beatIdx,
        beat_archetype: beat.archetype,
        format_id: format.id,
        theme_id: theme.id,
        style_id: style.id,
        aspect_ratio: aspect,
        duration_s: durationSeconds,
        reroll: true,
      },
    });

    // Splice new asset id at beat_idx; flip status to 'done'.
    const currentIds = (auth.session.videoClipAssetIds ?? []) as string[];
    const nextIds: string[] = new Array(beats.length).fill('');
    for (let i = 0; i < currentIds.length && i < nextIds.length; i++) {
      nextIds[i] = currentIds[i] ?? '';
    }
    nextIds[beatIdx] = assetId;
    statuses[beatIdx] = 'done';

    await db
      .update(sessions)
      .set({
        videoClipStatuses: statuses,
        videoClipAssetIds: nextIds,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    slot.slot.commit();
    committed = true;

    const clip: VideoClipWire = {
      beat_idx: beatIdx,
      status: 'done',
      asset_id: assetId,
      public_url: result.url,
    };
    return okJson(clip as unknown as Record<string, unknown>);
  } finally {
    if (!committed) slot.slot.releaseAndDontCount();
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function readStatuses(sessionId: string, beatCount: number): Promise<VideoClipStatus[]> {
  const db = getDb();
  const rows = await db
    .select({ statuses: sessions.videoClipStatuses })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const current = (rows[0]?.statuses as VideoClipStatus[] | null) ?? [];
  const out: VideoClipStatus[] = new Array(beatCount).fill('queued');
  for (let i = 0; i < Math.min(current.length, beatCount); i++) {
    out[i] = current[i] ?? 'queued';
  }
  return out;
}

async function persistStatuses(sessionId: string, statuses: VideoClipStatus[]): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ videoClipStatuses: statuses, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

function extractS3KeyFromPublicUrl(url: string): string {
  const base = (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  if (base && url.startsWith(base + '/')) {
    return url.slice(base.length + 1);
  }
  console.warn('[video.reroll] S3 public URL did not match S3_PUBLIC_BASE_URL prefix', {
    url,
    base,
  });
  const idx = url.indexOf('/sessions/');
  if (idx >= 0) return url.slice(idx + 1);
  return url;
}
