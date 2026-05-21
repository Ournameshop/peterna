import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { generateImage } from '@/lib/ai/generate-image';
import { AIError } from '@/lib/ai/types';
import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type {
  BeatWire,
  CardPreviewRenderResponse,
  CardPreviewWire,
} from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets, sessions } from '@/lib/db/schema';
import { findArtStyle } from '@/lib/library/art-styles';
import { findFormat } from '@/lib/library/formats';
import { findTheme } from '@/lib/library/themes';
import {
  buildClosingCard,
  buildInSceneCaption,
  buildOpeningCard,
  type CardKind,
} from '@/lib/prompts/build-card-preview';
import { aspectToImageSize, normalizeAspect } from '@/lib/prompts/build-preview';
import { authBySession } from '@/lib/session/auth';
import { checkSessionBudget } from '@/lib/session/budget';
import { acquireSessionSlot } from '@/lib/session/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * POST /api/card-preview/render (Stage 5.6, v2.3)
 *
 * Body: `CardPreviewRenderRequest` — `{ session_id }`. Renders three GPT
 * Image 2 stills sequentially at `quality: 'medium'` in the session's
 * aspect ratio:
 *   1. Opening title card (text = `sessions.opening_title_card_text`)
 *   2. Closing title card (text = `sessions.closing_card_text`)
 *   3. In-scene caption preview (first beat's scene + caption)
 *
 * Preconditions (all 400 unless noted):
 *   - `storyboard_approved_at` must be set
 *   - `opening_title_card_text` AND `closing_card_text` must be set
 *     (the /api/words/approve route writes defaults if the user skipped 5.5,
 *     so by the time this route fires both should be populated)
 *   - format/theme/style/aspect/character-sheet must all be set
 *   - first beat must exist with a non-empty caption
 *
 * Per-render behavior mirrors `storyboard/render`:
 *   - sole reference is the locked character-sheet public URL
 *   - vendor call via `generateImage({ stage: 'card_preview', quality: 'medium', ... })`
 *   - one `assets` row per card with `kind='card_preview'` and
 *     `metadata.card_kind` set so the row is self-describing
 *
 * Sequential render — three frames at gpt_image_2 medium is ~$0.12; the
 * budget check up-front guards against the rare "session already spent
 * its cap" case. The whole batch shares one Idempotency-Key (from the
 * client header), with deterministic sub-keys per card so retries inside
 * the dedup window short-circuit per card at the renders table.
 *
 * On vendor failure we bail and return the failure code — already-rendered
 * cards remain in S3 + assets but `sessions.card_preview_asset_ids` is not
 * updated. The client retries the whole render-all (the sub-keys dedupe
 * the cards we already paid for).
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
  if (!session.storyboard_approved_at) {
    return errJson('no-words', { status: 400, details: { reason: 'storyboard-not-approved' } });
  }
  const opening = session.opening_title_card_text;
  const closing = session.closing_card_text;
  if (!opening || !closing) {
    return errJson('no-words', {
      status: 400,
      details: {
        missing: [
          ...(opening ? [] : ['opening_title_card_text']),
          ...(closing ? [] : ['closing_card_text']),
        ],
      },
    });
  }

  const formatId = session.format_id;
  const themeId = session.theme_id;
  const styleId = session.style_id;
  const aspectRatio = session.aspect_ratio;
  const charSheetAssetId = session.character_sheet_asset_id;
  const missing: string[] = [];
  if (!formatId) missing.push('format_id');
  if (!themeId) missing.push('theme_id');
  if (!styleId) missing.push('style_id');
  if (!aspectRatio) missing.push('aspect_ratio');
  if (!charSheetAssetId) missing.push('character_sheet_asset_id');
  if (missing.length > 0) {
    return errJson('no-words', { status: 400, details: { missing } });
  }

  const format = findFormat(formatId);
  const theme = findTheme(themeId);
  const style = findArtStyle(styleId);
  if (!format || !theme || !style) {
    return errJson('no-words', {
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

  const beats = (session.beat_sheet ?? []) as BeatWire[];
  // First beat by index — the storyboard ordering invariant comes from
  // /api/beat-sheet/approve, which gates approval on the array being
  // non-empty.
  const firstBeat = [...beats].sort((a, b) => a.idx - b.idx)[0];
  if (!firstBeat || !firstBeat.caption?.trim() || !firstBeat.scene_description?.trim()) {
    return errJson('no-words', {
      status: 400,
      details: { reason: 'first-beat-missing-or-incomplete' },
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

    // Resolve character sheet — sole reference for every card.
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
      return errJson('no-words', {
        status: 400,
        details: { reason: 'character-sheet-not-locked' },
      });
    }

    const aspect = normalizeAspect(aspectRatio);
    const imageSize = aspectToImageSize(aspect);

    // The three prompts to render, in the canonical order. Persisted into
    // `card_preview_asset_ids` as [opening, closing, in_scene] per the
    // schema comment at `sessions.cardPreviewAssetIds`.
    const renderPlan: Array<{
      kind: CardKind;
      prompt: string;
      references: Array<{ url: string; role: 'subject' }>;
    }> = [
      (() => {
        const built = buildOpeningCard({
          session,
          format,
          theme,
          style,
          charSheetUrl: charSheet.url,
          openingText: opening,
        });
        return { kind: 'opening', ...built };
      })(),
      (() => {
        const built = buildClosingCard({
          session,
          format,
          theme,
          style,
          charSheetUrl: charSheet.url,
          closingText: closing,
        });
        return { kind: 'closing', ...built };
      })(),
      (() => {
        const built = buildInSceneCaption({
          session,
          format,
          theme,
          style,
          charSheetUrl: charSheet.url,
          beat: firstBeat,
        });
        return { kind: 'in_scene_caption', ...built };
      })(),
    ];

    const cards: CardPreviewWire[] = [];
    const cardAssetIds: string[] = [];

    for (const item of renderPlan) {
      let result;
      try {
        result = await generateImage({
          prompt: item.prompt,
          references: item.references,
          size: imageSize,
          quality: 'medium',
          aspectRatio: aspect,
          sessionId,
          idempotencyKey: `${batchKey}:card-${item.kind}`,
          stage: 'card_preview',
        });
      } catch (err) {
        if (err instanceof AIError) {
          slot.slot.commit();
          committed = true;
          console.error('[card-preview.render] AIError', {
            card_kind: item.kind,
            code: err.code,
            attempts: err.attempts,
          });
          if (err.code === 'content_policy') {
            return errJson('content-policy-violation', {
              status: 422,
              details: { card_kind: item.kind },
            });
          }
          const respBody: Extract<CardPreviewRenderResponse, { ok: false }> = {
            ok: false,
            error: 'render_failed',
            card_kind: item.kind,
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
        kind: 'card_preview',
        source: 'vendor_render',
        r2Key: s3Key,
        publicUrl: result.url,
        mimeType: 'image/png',
        metadata: {
          vendor_served: result.vendorServed,
          vendor_attempted: result.vendorAttempted,
          cost_usd_est: result.costUsdEst,
          duration_ms: result.durationMs,
          card_kind: item.kind,
          format_id: format.id,
          theme_id: theme.id,
          style_id: style.id,
          aspect_ratio: aspect,
        },
      });

      cardAssetIds.push(assetId);
      cards.push({ kind: item.kind, asset_id: assetId, public_url: result.url });
    }

    // All three cards rendered — persist the id array and advance stage.
    await db
      .update(sessions)
      .set({
        cardPreviewAssetIds: cardAssetIds,
        stage: 'card_preview_review',
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    slot.slot.commit();
    committed = true;

    return okJson({ cards });
  } finally {
    if (!committed) slot.slot.releaseAndDontCount();
  }
}

/**
 * Inverse of `getPublicUrl(key)` — same defensive fallback as the other
 * Phase 2-4 render routes. If the URL doesn't match `S3_PUBLIC_BASE_URL`,
 * try to extract the `sessions/<id>/...` tail and log the mismatch.
 */
function extractS3KeyFromPublicUrl(url: string): string {
  const base = (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  if (base && url.startsWith(base + '/')) {
    return url.slice(base.length + 1);
  }
  console.warn('[card-preview.render] S3 public URL did not match S3_PUBLIC_BASE_URL prefix', {
    url,
    base,
  });
  const idx = url.indexOf('/sessions/');
  if (idx >= 0) return url.slice(idx + 1);
  return url;
}
