import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { generateImage } from '@/lib/ai/generate-image';
import { AIError } from '@/lib/ai/types';
import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type {
  BeatWire,
  StoryboardFrameWire,
  StoryboardRenderResponse,
} from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets, sessions } from '@/lib/db/schema';
import { findArtStyle } from '@/lib/library/art-styles';
import { findFormat } from '@/lib/library/formats';
import { findTheme } from '@/lib/library/themes';
import { aspectToImageSize, normalizeAspect } from '@/lib/prompts/build-preview';
import { buildStoryboardFramePrompt } from '@/lib/prompts/build-storyboard-frame';
import { authBySession } from '@/lib/session/auth';
import { checkSessionBudget } from '@/lib/session/budget';
import { acquireSessionSlot } from '@/lib/session/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * POST /api/storyboard/render
 *
 * Body: `StoryboardRenderRequest` — `{ session_id }`. Renders ALL N storyboard
 * frames (one per beat) sequentially at `quality: 'medium'` in the session's
 * aspect ratio. The sole reference per frame is the locked character sheet.
 *
 * Preconditions (all 400 unless noted):
 *   - `beat_sheet` null or empty array → `no-beats`
 *   - `beat_sheet_approved_at` null → `beat-sheet-not-approved`
 *   - `character_sheet_asset_id` / `format_id` / `theme_id` / `style_id` /
 *     `aspect_ratio` missing → `no-beats` with `details.missing` (the gate
 *     should never let the user get here without Stage 3 locked, so we lump
 *     these together rather than minting a new error code)
 *
 * Phase 4b: sequential render. Per-beat cost ~$0.04 at gpt_image_2 medium →
 * ~$0.32 for an 8-beat tribute, well under the $10 session cap which is
 * checked once up-front. Phase 6+ may parallelize via a queue.
 *
 * Per-beat behavior mirrors `preview/render`:
 *   - prompt built by `buildStoryboardFramePrompt`
 *   - vendor call via `generateImage({ stage: 'storyboard', quality: 'medium', ... })`
 *   - on success, an `assets` row is inserted with `kind='storyboard_frame'` and
 *     `metadata.beat_idx` set so the row is self-describing
 *
 * The whole batch shares one `Idempotency-Key` (the caller sends one header for
 * the render-all call). Each per-beat vendor call uses a deterministic
 * sub-key derived from the batch key + beat idx so retries inside the dedup
 * window short-circuit per beat at the renders table.
 *
 * On vendor failure mid-batch we bail and return the failure code — already-
 * rendered frames remain in S3 + assets but `sessions.storyboard_frame_asset_ids`
 * is not updated. The client retries the whole render-all (the sub-keys dedupe
 * the frames we already paid for).
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
  const beats = (session.beat_sheet ?? []) as BeatWire[];
  if (!Array.isArray(beats) || beats.length === 0) {
    return errJson('no-beats', { status: 400 });
  }
  if (!session.beat_sheet_approved_at) {
    return errJson('beat-sheet-not-approved', { status: 400 });
  }

  const charSheetAssetId = session.character_sheet_asset_id;
  const formatId = session.format_id;
  const themeId = session.theme_id;
  const styleId = session.style_id;
  const aspectRatio = session.aspect_ratio;
  const missing: string[] = [];
  if (!charSheetAssetId) missing.push('character_sheet_asset_id');
  if (!formatId) missing.push('format_id');
  if (!themeId) missing.push('theme_id');
  if (!styleId) missing.push('style_id');
  if (!aspectRatio) missing.push('aspect_ratio');
  if (missing.length > 0) {
    return errJson('no-beats', { status: 400, details: { missing } });
  }

  const format = findFormat(formatId);
  const theme = findTheme(themeId);
  const style = findArtStyle(styleId);
  if (!format || !theme || !style) {
    return errJson('no-beats', {
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

  // Idempotency-Key from the client — one for the whole batch. Per-beat
  // sub-keys derive from this so a retry of the same batch dedupes per beat
  // at the `renders` table's `(session_id, stage, idempotency_key)` unique
  // index. Absent header → fresh batch UUID.
  const batchKey = req.headers.get('idempotency-key') ?? uuidv7();

  let committed = false;
  try {
    const db = getDb();

    // Resolve character sheet URL — sole reference for every frame.
    const charRows = await db
      .select({ url: assets.publicUrl, kind: assets.kind })
      .from(assets)
      .where(
        and(
          eq(assets.id, charSheetAssetId!),
          eq(assets.sessionId, sessionId),
        ),
      )
      .limit(1);
    const charSheet = charRows[0];
    if (!charSheet || charSheet.kind !== 'character_sheet') {
      slot.slot.releaseAndDontCount();
      committed = true;
      return errJson('no-beats', {
        status: 400,
        details: { reason: 'character-sheet-not-locked' },
      });
    }

    const aspect = normalizeAspect(aspectRatio);
    const imageSize = aspectToImageSize(aspect);

    const sortedBeats = [...beats].sort((a, b) => a.idx - b.idx);
    const frames: StoryboardFrameWire[] = [];
    const frameAssetIds: string[] = new Array(sortedBeats.length).fill('');

    for (const beat of sortedBeats) {
      const { prompt, references } = buildStoryboardFramePrompt({
        session,
        beat,
        format,
        theme,
        style,
        charSheetUrl: charSheet.url,
      });

      let result;
      try {
        result = await generateImage({
          prompt,
          references,
          size: imageSize,
          quality: 'medium',
          aspectRatio: aspect,
          sessionId,
          idempotencyKey: `${batchKey}:beat-${beat.idx}`,
          stage: 'storyboard',
        });
      } catch (err) {
        if (err instanceof AIError) {
          slot.slot.commit();
          committed = true;
          console.error('[storyboard.render] AIError', {
            beat_idx: beat.idx,
            code: err.code,
            attempts: err.attempts,
          });
          if (err.code === 'content_policy') {
            return errJson('content-policy-violation', { status: 422, details: { beat_idx: beat.idx } });
          }
          const respBody: Extract<StoryboardRenderResponse, { ok: false }> = {
            ok: false,
            error: 'render_failed',
            beat_idx: beat.idx,
          };
          return Response.json(respBody, { status: 502 });
        }
        throw err;
      }

      const assetId = uuidv7();
      const s3Key = extractS3KeyFromPublicUrl(result.url);

      await db.insert(assets).values({
        id: assetId,
        sessionId,
        kind: 'storyboard_frame',
        source: 'vendor_render',
        r2Key: s3Key,
        publicUrl: result.url,
        mimeType: 'image/png',
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
          aspect_ratio: aspect,
        },
      });

      frameAssetIds[beat.idx] = assetId;
      frames.push({ beat_idx: beat.idx, asset_id: assetId, public_url: result.url });
    }

    // All frames rendered — persist the asset-id array and advance stage.
    await db
      .update(sessions)
      .set({
        storyboardFrameAssetIds: frameAssetIds,
        stage: 'storyboard_review',
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    slot.slot.commit();
    committed = true;

    // Ensure frames are returned in beat-idx order.
    frames.sort((a, b) => a.beat_idx - b.beat_idx);
    return okJson({ frames });
  } finally {
    if (!committed) slot.slot.releaseAndDontCount();
  }
}

/**
 * Inverse of `getPublicUrl(key)`. Same defensive fallback as the other
 * render routes — if the URL doesn't match `S3_PUBLIC_BASE_URL`, try to
 * extract the `sessions/<id>/...` tail; log loudly on mismatch.
 */
function extractS3KeyFromPublicUrl(url: string): string {
  const base = (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  if (base && url.startsWith(base + '/')) {
    return url.slice(base.length + 1);
  }
  console.warn('[storyboard.render] S3 public URL did not match S3_PUBLIC_BASE_URL prefix', {
    url,
    base,
  });
  const idx = url.indexOf('/sessions/');
  if (idx >= 0) return url.slice(idx + 1);
  return url;
}
