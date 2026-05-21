import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { generateImage } from '@/lib/ai/generate-image';
import { AIError } from '@/lib/ai/types';
import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type {
  BeatWire,
  StoryboardFrameWire,
  StoryboardRerollResponse,
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
 * POST /api/storyboard/reroll
 *
 * Body: `StoryboardRerollRequest` — `{ session_id, beat_idx, refinements? }`.
 * Re-renders a single storyboard frame. Refinements (if provided) are appended
 * to the prompt as a bullet list.
 *
 * Behavior:
 *   - Inserts a NEW `assets` row each time (never overwrites — preserves cost
 *     audit history). Updates `sessions.storyboard_frame_asset_ids[beat_idx]`
 *     to point at the new asset_id.
 *   - One render slot + budget check, mirroring `character-sheet/render`.
 *   - `Idempotency-Key` is per-beat (the UI sends one key per reroll click).
 *
 * Preconditions:
 *   - session must have a beat_sheet with an entry at `beat_idx`
 *   - session must have all of `character_sheet_asset_id` / `format_id` /
 *     `theme_id` / `style_id` / `aspect_ratio` set
 *   - Either render has already been performed (storyboard_frame_asset_ids
 *     populated at index beat_idx) OR the user is rerolling immediately after
 *     a partial-failure batch — we allow both; the array is updated with the
 *     new asset id either way.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { session_id?: unknown; beat_idx?: unknown; refinements?: unknown };
  try {
    body = (await req.json()) as { session_id?: unknown; beat_idx?: unknown; refinements?: unknown };
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

  let refinements: string[] = [];
  if (body.refinements != null) {
    if (
      !Array.isArray(body.refinements) ||
      !body.refinements.every((x) => typeof x === 'string')
    ) {
      return errJson('invalid-input', { status: 400, details: { field: 'refinements' } });
    }
    refinements = body.refinements as string[];
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const session = serializeSession(auth.session);

  const beats = (session.beat_sheet ?? []) as BeatWire[];
  const beat = beats.find((b) => b.idx === beatIdx);
  if (!beat) {
    return errJson('beat-not-found', { status: 404, details: { beat_idx: beatIdx } });
  }

  const charSheetAssetId = session.character_sheet_asset_id;
  const formatId = session.format_id;
  const themeId = session.theme_id;
  const styleId = session.style_id;
  const aspectRatio = session.aspect_ratio;
  if (!charSheetAssetId || !formatId || !themeId || !styleId || !aspectRatio) {
    return errJson('invalid-input', {
      status: 400,
      details: { reason: 'incomplete-stage-3-or-character-sheet' },
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

  const budget = await checkSessionBudget(sessionId);
  if (!budget.ok) return errJson(budget.reason, { status: 429 });

  const slot = acquireSessionSlot(sessionId);
  if (!slot.ok) {
    if (slot.reason === 'in_flight') {
      return errJson('render-in-flight', { status: 409, headers: { 'Retry-After': '5' } });
    }
    return errJson('session-budget-exceeded', { status: 429 });
  }

  const idempotencyKey = req.headers.get('idempotency-key') ?? uuidv7();

  let committed = false;
  try {
    const db = getDb();

    const charRows = await db
      .select({ url: assets.publicUrl, kind: assets.kind })
      .from(assets)
      .where(
        and(
          eq(assets.id, charSheetAssetId),
          eq(assets.sessionId, sessionId),
        ),
      )
      .limit(1);
    const charSheet = charRows[0];
    if (!charSheet || charSheet.kind !== 'character_sheet') {
      slot.slot.releaseAndDontCount();
      committed = true;
      return errJson('invalid-input', {
        status: 400,
        details: { reason: 'character-sheet-not-locked' },
      });
    }

    const aspect = normalizeAspect(aspectRatio);
    const { prompt, references } = buildStoryboardFramePrompt({
      session,
      beat,
      format,
      theme,
      style,
      charSheetUrl: charSheet.url,
      refinements,
    });

    let result;
    try {
      result = await generateImage({
        prompt,
        references,
        size: aspectToImageSize(aspect),
        quality: 'medium',
        aspectRatio: aspect,
        sessionId,
        idempotencyKey,
        stage: 'storyboard',
      });
    } catch (err) {
      if (err instanceof AIError) {
        slot.slot.commit();
        committed = true;
        console.error('[storyboard.reroll] AIError', {
          beat_idx: beatIdx,
          code: err.code,
          attempts: err.attempts,
        });
        if (err.code === 'content_policy') {
          return errJson('content-policy-violation', { status: 422 });
        }
        const respBody: Extract<StoryboardRerollResponse, { ok: false }> = {
          ok: false,
          error: 'render_failed',
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
        beat_idx: beatIdx,
        beat_archetype: beat.archetype,
        format_id: format.id,
        theme_id: theme.id,
        style_id: style.id,
        aspect_ratio: aspect,
        refinement_count: refinements.length,
        reroll: true,
      },
    });

    // Splice the new asset_id into storyboard_frame_asset_ids[beat_idx]. We
    // hold the session's single in-flight slot during this whole call, so
    // read-modify-write is safe (no concurrent writer can race us under the
    // current single-process rate-limit model — see `rate-limit.ts`).
    //
    // The array may be null (reroll after a partial-failure batch never
    // committed) or shorter than `beats.length`; coalesce + pad before
    // writing the new id at `beat_idx`.
    const currentIds = auth.session.storyboardFrameAssetIds ?? [];
    const nextIds: string[] = new Array(beats.length).fill('');
    for (let i = 0; i < currentIds.length && i < nextIds.length; i++) {
      nextIds[i] = currentIds[i] ?? '';
    }
    nextIds[beatIdx] = assetId;

    await db
      .update(sessions)
      .set({
        storyboardFrameAssetIds: nextIds,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    slot.slot.commit();
    committed = true;

    const frame: StoryboardFrameWire = {
      beat_idx: beatIdx,
      asset_id: assetId,
      public_url: result.url,
    };
    return okJson(frame as unknown as Record<string, unknown>);
  } finally {
    if (!committed) slot.slot.releaseAndDontCount();
  }
}

function extractS3KeyFromPublicUrl(url: string): string {
  const base = (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  if (base && url.startsWith(base + '/')) {
    return url.slice(base.length + 1);
  }
  console.warn('[storyboard.reroll] S3 public URL did not match S3_PUBLIC_BASE_URL prefix', {
    url,
    base,
  });
  const idx = url.indexOf('/sessions/');
  if (idx >= 0) return url.slice(idx + 1);
  return url;
}
