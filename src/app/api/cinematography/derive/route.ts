import { eq, inArray } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { runFrameVision } from '@/lib/ai/run-frame-vision';
import { AIError } from '@/lib/ai/types';
import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type {
  BeatWire,
  CinematographyDeriveResponse,
  DpStyleOverlayId,
  FrameVisionWire,
  MotionBriefWire,
} from '@/lib/builder/wire-types';
import {
  type BeatMetadata,
  deriveMotionBrief,
  emotionalRegisterFor,
  isCeremonialFormat,
} from '@/lib/cinematography/derive-motion-brief';
import {
  type ConsistencyInput,
  applyConsistencyPass,
} from '@/lib/cinematography/consistency-pass';
import { applyDpStyleOverlay } from '@/lib/cinematography/dp-styles';
import { getDb } from '@/lib/db/client';
import { assets, sessions } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';
import { checkSessionBudget } from '@/lib/session/budget';
import { acquireSessionSlot } from '@/lib/session/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const DP_STYLE_OVERLAYS: ReadonlySet<DpStyleOverlayId> = new Set([
  'deakins_minimalist',
  'lubezki_natural',
  'young_intimate',
  'khondji_painterly',
  'wong_kar_wai_dreamy',
  'none',
]);

/**
 * POST /api/cinematography/derive (Stage 5.7, v2.0)
 *
 * Body: `CinematographyDeriveRequest` — `{ session_id, dp_style_overlay? }`.
 *
 * Preconditions:
 *   - `storyboard_approved_at` non-null (the storyboard MUST be locked
 *     before we burn vision-pass credits)
 *   - `storyboard_frame_asset_ids.length === beat_count` (the storyboard is
 *     a complete N-frame set; otherwise the cinematography brief would be
 *     partial — bail rather than render a partial brief table)
 *   - `format_id` + `theme_id` set on the session
 *   - `beat_sheet` present and non-empty
 *
 * Process:
 *   1. Load all N storyboard frame asset URLs.
 *   2. Run `runFrameVision` per frame in parallel (Promise.all; each call
 *      has its own 8s vendor timeout — N=8 finishes well inside maxDuration).
 *   3. Derive a `MotionBriefWire` per beat via `deriveMotionBrief`.
 *   4. Optionally apply the DP-style overlay (bias only).
 *   5. Run the consistency pass (lens range / move variety / calm bookends
 *      / caption-readable / ambient continuity) — non-negotiable.
 *   6. Persist `cinematography_frame_vision`, `cinematography_briefs`, and
 *      (optionally) `cinematography_dp_overlay`. Advance stage to
 *      `cinematography_review` (Phase 6 review screen).
 *
 * Cost: N × ~$0.005 vision-pass calls ≈ $0.04 for an 8-beat tribute. Well
 * under the $10 session budget cap which is checked once up-front.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { session_id?: unknown; dp_style_overlay?: unknown };
  try {
    body = (await req.json()) as { session_id?: unknown; dp_style_overlay?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }
  const sessionId = body.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }

  let dpStyleOverlay: DpStyleOverlayId | undefined;
  if (body.dp_style_overlay != null) {
    if (
      typeof body.dp_style_overlay !== 'string' ||
      !DP_STYLE_OVERLAYS.has(body.dp_style_overlay as DpStyleOverlayId)
    ) {
      return errJson('invalid-input', {
        status: 400,
        details: { field: 'dp_style_overlay' },
      });
    }
    dpStyleOverlay = body.dp_style_overlay as DpStyleOverlayId;
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const session = serializeSession(auth.session);

  // -------- preconditions --------
  if (!session.storyboard_approved_at) {
    return errJson('storyboard-not-approved', { status: 400 });
  }
  const beats = (session.beat_sheet ?? []) as BeatWire[];
  if (!Array.isArray(beats) || beats.length === 0) {
    return errJson('storyboard-not-approved', {
      status: 400,
      details: { reason: 'no-beats' },
    });
  }
  const beatCount = session.beat_count ?? beats.length;
  const frameAssetIds = session.storyboard_frame_asset_ids ?? null;
  if (
    !frameAssetIds ||
    !Array.isArray(frameAssetIds) ||
    frameAssetIds.length !== beatCount ||
    frameAssetIds.some((id) => !id)
  ) {
    return errJson('storyboard-not-approved', {
      status: 400,
      details: {
        beat_count: beatCount,
        frame_count: Array.isArray(frameAssetIds) ? frameAssetIds.length : 0,
      },
    });
  }
  const formatId = session.format_id;
  const themeId = session.theme_id;
  if (!formatId || !themeId) {
    return errJson('invalid-input', {
      status: 400,
      details: {
        missing: [
          ...(formatId ? [] : ['format_id']),
          ...(themeId ? [] : ['theme_id']),
        ],
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

  let committed = false;
  try {
    const db = getDb();

    // Load all frame asset rows in one round-trip, keyed by id.
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
      if (row.sessionId !== sessionId) continue; // defensive — assets are FK'd to session
      if (row.kind !== 'storyboard_frame') continue;
      urlByAssetId.set(row.id, row.publicUrl);
    }

    // Build an ordered list of { beatIdx, url } pairs. We rely on the
    // invariant that `storyboard_frame_asset_ids[i]` is the frame for
    // beat_idx === i (the storyboard render route writes the array in
    // beat-idx order).
    const frameJobs: Array<{ beatIdx: number; url: string }> = [];
    for (let i = 0; i < frameAssetIds.length; i += 1) {
      const url = urlByAssetId.get(frameAssetIds[i]!);
      if (!url) {
        slot.slot.releaseAndDontCount();
        committed = true;
        return errJson('storyboard-not-approved', {
          status: 400,
          details: { reason: 'frame-asset-missing', beat_idx: i },
        });
      }
      frameJobs.push({ beatIdx: i, url });
    }

    // Step 1+2 — run vision pass per frame in parallel.
    const visionResults = await runFrameVisionBatch(frameJobs, sessionId, batchKey);
    if (visionResults.failure) {
      slot.slot.commit();
      committed = true;
      const { code, beatIdx } = visionResults.failure;
      if (code === 'content_policy') {
        return errJson('content-policy-violation', {
          status: 422,
          details: { beat_idx: beatIdx },
        });
      }
      const respBody: Extract<CinematographyDeriveResponse, { ok: false }> = {
        ok: false,
        error: 'render_failed',
        beat_idx: beatIdx,
      };
      return Response.json(respBody, { status: 502 });
    }

    const frameVision: FrameVisionWire[] = visionResults.frames;

    // Step 3 — derive per-beat motion briefs.
    const emotionalRegister = emotionalRegisterFor(themeId);
    const formatCtx = { formatId, ceremonial: isCeremonialFormat(formatId) };
    const themeCtx = { themeId, emotionalRegister };
    const beatsByIdx = new Map<number, BeatWire>();
    for (const b of beats) beatsByIdx.set(b.idx, b);

    const sortedVision = [...frameVision].sort((a, b) => a.beat_idx - b.beat_idx);
    const lastIdx = sortedVision.length - 1;
    const derived: MotionBriefWire[] = [];
    for (const vision of sortedVision) {
      const beat = beatsByIdx.get(vision.beat_idx);
      if (!beat) continue;
      const meta: BeatMetadata = {
        beatIdx: vision.beat_idx,
        archetype: beat.archetype,
        positionInArc: lastIdx === 0 ? 0 : vision.beat_idx / lastIdx,
        captionWordCount: countWords(beat.caption),
      };
      derived.push(deriveMotionBrief(vision, meta, formatCtx, themeCtx, derived));
    }

    // Step 4 — DP overlay (bias only).
    const overlayed = applyDpStyleOverlay(derived, dpStyleOverlay ?? 'none');

    // Step 5 — consistency pass (non-negotiable).
    const consistencyInputs: ConsistencyInput[] = sortedVision.map((v) => {
      const beat = beatsByIdx.get(v.beat_idx);
      return {
        beat_idx: v.beat_idx,
        captionWordCount: beat ? countWords(beat.caption) : 0,
        archetype: beat?.archetype ?? 'unknown',
      };
    });
    const briefs = applyConsistencyPass(overlayed, {
      formatId,
      beatInputs: consistencyInputs,
    });

    // Step 6 — persist.
    await db
      .update(sessions)
      .set({
        cinematographyFrameVision: frameVision,
        cinematographyBriefs: briefs,
        cinematographyDpOverlay: dpStyleOverlay ?? 'none',
        // Stage tag is "cinematography_review" per the spec brief; the state
        // machine in `state.ts` still treats `cinematography_brief` as the
        // entry. Frontend agent will wire the review stage. For now we
        // advance to the entry tag so the FE has a known landing — the
        // legalNextStages probe permits same-stage idempotent updates.
        stage: 'cinematography_brief',
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    slot.slot.commit();
    committed = true;

    return okJson({ frame_vision: frameVision, briefs });
  } finally {
    if (!committed) slot.slot.releaseAndDontCount();
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type FrameVisionBatchResult =
  | { failure?: undefined; frames: FrameVisionWire[] }
  | { failure: { code: 'render_failed' | 'content_policy'; beatIdx: number }; frames: FrameVisionWire[] };

async function runFrameVisionBatch(
  jobs: ReadonlyArray<{ beatIdx: number; url: string }>,
  sessionId: string,
  batchKey: string,
): Promise<FrameVisionBatchResult> {
  try {
    const results = await Promise.all(
      jobs.map((job) =>
        runFrameVision({
          frameUrl: job.url,
          beatIdx: job.beatIdx,
          sessionId,
          idempotencyKey: `${batchKey}:frame-${job.beatIdx}`,
        }),
      ),
    );
    const frames: FrameVisionWire[] = results.map((r) => ({
      beat_idx: r.beatIdx,
      subject_energy: r.subjectEnergy,
      subject_pose: r.subjectPose,
      framing: r.framing,
      environmental_motion: r.environmentalMotion,
      depth_layers: r.depthLayers,
      dominant_palette_temperature: r.dominantPaletteTemperature,
    }));
    return { frames };
  } catch (err) {
    if (err instanceof AIError) {
      console.error('[cinematography.derive] AIError', {
        code: err.code,
        attempts: err.attempts,
      });
      if (err.code === 'content_policy') {
        return { failure: { code: 'content_policy', beatIdx: -1 }, frames: [] };
      }
      return { failure: { code: 'render_failed', beatIdx: -1 }, frames: [] };
    }
    throw err;
  }
}

function countWords(s: string | null | undefined): number {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}
