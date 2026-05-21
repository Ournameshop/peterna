import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { generateImage } from '@/lib/ai/generate-image';
import { AIError } from '@/lib/ai/types';
import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type { PreviewRenderResponse } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets } from '@/lib/db/schema';
import { findArtStyle } from '@/lib/library/art-styles';
import { findFormat } from '@/lib/library/formats';
import { findTheme } from '@/lib/library/themes';
import {
  aspectToImageSize,
  buildPreviewPrompt,
  normalizeAspect,
} from '@/lib/prompts/build-preview';
import { authBySession } from '@/lib/session/auth';
import { checkSessionBudget } from '@/lib/session/budget';
import { acquireSessionSlot } from '@/lib/session/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * POST /api/preview/render
 *
 * Body: `PreviewRenderRequest` (snake_case) — just `{ session_id }`. All other inputs come from
 * the session row (`character_sheet_asset_id`, `format_id`, `theme_id`, `style_id`,
 * `aspect_ratio`). The route enforces all five preconditions before any vendor work fires.
 *
 * Behavior mirrors `character-sheet/render` (same envelope, same rate-limit / budget / slot
 * contract, same `Idempotency-Key` semantics, same vendor-error mapping). Differences:
 *   - sole reference is the character sheet's public URL with role `'subject'`
 *   - prompt is built from `src/lib/prompts/build-preview.ts` using format + theme + style
 *     library entries
 *   - image size is aspect-mapped (`9:16` → 1024x1536, `16:9` → 1536x1024, `1:1` → 1024x1024)
 *     at `quality: 'medium'` (cheaper than the character sheet — this is a single confirm frame)
 *   - stored `assets` row has `kind='combination_preview'`
 *
 * Preconditions and their failure modes (all 400 unless noted):
 *   - `character_sheet_asset_id` null → `character-sheet-not-locked`
 *   - any of `format_id` / `theme_id` / `style_id` / `aspect_ratio` null → `incomplete-stage-3`
 *   - any of those ids unknown to the library → `incomplete-stage-3` (with `field` detail)
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
  if (!session.character_sheet_asset_id) {
    return errJson('character-sheet-not-locked', { status: 400 });
  }
  const formatId = session.format_id;
  const themeId = session.theme_id;
  const styleId = session.style_id;
  const aspectRatio = session.aspect_ratio;
  const missing: string[] = [];
  if (!formatId) missing.push('format_id');
  if (!themeId) missing.push('theme_id');
  if (!styleId) missing.push('style_id');
  if (!aspectRatio) missing.push('aspect_ratio');
  if (missing.length > 0) {
    return errJson('incomplete-stage-3', { status: 400, details: { missing } });
  }

  const format = findFormat(formatId);
  const theme = findTheme(themeId);
  const style = findArtStyle(styleId);
  if (!format || !theme || !style) {
    return errJson('incomplete-stage-3', {
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

  // -------- budget + in-flight slot (mirror character-sheet/render order) --------
  const budget = await checkSessionBudget(sessionId);
  if (!budget.ok) return errJson(budget.reason, { status: 429 });

  const slot = acquireSessionSlot(sessionId);
  if (!slot.ok) {
    if (slot.reason === 'in_flight') {
      return errJson('render-in-flight', { status: 409, headers: { 'Retry-After': '5' } });
    }
    return errJson('session-budget-exceeded', { status: 429 });
  }

  const idempotencyKey = req.headers.get('idempotency-key') ?? undefined;

  let committed = false;
  try {
    const db = getDb();

    // Resolve the character sheet's public URL — it is the SOLE reference.
    const charRows = await db
      .select({ url: assets.publicUrl, kind: assets.kind })
      .from(assets)
      .where(
        and(
          eq(assets.id, session.character_sheet_asset_id),
          eq(assets.sessionId, sessionId),
        ),
      )
      .limit(1);
    const charSheet = charRows[0];
    if (!charSheet) {
      // Defensive: session row points at an asset we can't see. Treat as "not locked"
      // rather than 500 — the user can re-approve the sheet to recover.
      slot.slot.releaseAndDontCount();
      committed = true;
      return errJson('character-sheet-not-locked', { status: 400 });
    }
    if (charSheet.kind !== 'character_sheet') {
      slot.slot.releaseAndDontCount();
      committed = true;
      return errJson('character-sheet-not-locked', { status: 400 });
    }

    const aspect = normalizeAspect(aspectRatio);
    const { prompt, references } = buildPreviewPrompt({
      session,
      charSheetUrl: charSheet.url,
      format,
      theme,
      style,
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
        idempotencyKey: idempotencyKey ?? uuidv7(),
        stage: 'combination_preview',
      });
    } catch (err) {
      if (err instanceof AIError) {
        slot.slot.commit();
        committed = true;
        console.error('[preview.render] AIError', {
          code: err.code,
          attempts: err.attempts,
        });
        if (err.code === 'content_policy') {
          return errJson('content-policy-violation', { status: 422 });
        }
        const respBody: Extract<PreviewRenderResponse, { ok: false }> = {
          ok: false,
          error: 'render_failed',
        };
        return Response.json(respBody, { status: 502 });
      }
      throw err;
    }

    // Persist the S3-rehosted output as a `combination_preview` asset row.
    const assetId = uuidv7();
    const s3Key = extractS3KeyFromPublicUrl(result.url);

    await db.insert(assets).values({
      id: assetId,
      sessionId,
      kind: 'combination_preview',
      source: 'vendor_render',
      r2Key: s3Key,
      publicUrl: result.url,
      mimeType: 'image/png',
      metadata: {
        vendor_served: result.vendorServed,
        vendor_attempted: result.vendorAttempted,
        cost_usd_est: result.costUsdEst,
        duration_ms: result.durationMs,
        format_id: format.id,
        theme_id: theme.id,
        style_id: style.id,
        aspect_ratio: aspect,
      },
    });

    slot.slot.commit();
    committed = true;

    return okJson({
      render_id: idempotencyKey ?? assetId,
      asset_id: assetId,
      public_url: result.url,
    });
  } finally {
    if (!committed) slot.slot.releaseAndDontCount();
  }
}

/**
 * Inverse of `getPublicUrl(key)`. Same defensive fallback as
 * `character-sheet/render` — if the URL doesn't match `S3_PUBLIC_BASE_URL`,
 * try to extract the `sessions/<id>/...` tail; log loudly on mismatch.
 */
function extractS3KeyFromPublicUrl(url: string): string {
  const base = (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  if (base && url.startsWith(base + '/')) {
    return url.slice(base.length + 1);
  }
  console.warn('[preview.render] S3 public URL did not match S3_PUBLIC_BASE_URL prefix', {
    url,
    base,
  });
  const idx = url.indexOf('/sessions/');
  if (idx >= 0) return url.slice(idx + 1);
  return url;
}
