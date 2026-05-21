import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { generateImage } from '@/lib/ai/generate-image';
import { AIError } from '@/lib/ai/types';
import { errJson, okJson } from '@/lib/api/respond';
import type { CharacterSheetRenderResponse } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets } from '@/lib/db/schema';
import { buildCharacterSheetPrompt } from '@/lib/prompts/build-character-sheet';
import { serializeSession } from '@/lib/builder/serialize';
import { authBySession } from '@/lib/session/auth';
import { checkSessionBudget } from '@/lib/session/budget';
import { acquireSessionSlot } from '@/lib/session/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * POST /api/character-sheet/render
 *
 * Body: `CharacterSheetRenderRequest` (snake_case). Renders the 4-view 2K sheet at
 * `quality: 'high'`, passing ALL of the session's `pet_photo` assets as references for
 * likeness (spec mandates multi-photo reference — see `risk-register.md` Risk #1).
 *
 * On success: writes an `assets` row with `kind='character_sheet'`, `source='vendor_render'`,
 * and returns `{ ok: true, render_id, asset_id, public_url }`. The session row is NOT
 * advanced here — the user reviews the sheet at `character_sheet_review` and either
 * approves it (`/api/character-sheet/approve`) or kicks off a new render with corrections.
 *
 * Rate / budget contract (mirrors `vision-pass`):
 *   - `acquireSessionSlot` → 1 in-flight per session, 20/hr. 409 on conflict with `Retry-After: 5`.
 *   - `checkSessionBudget` → reads `sum(renders.cost_usd_est)`. 429 on >= $10.
 *   - `Idempotency-Key` header → flowed through to `renders` insert in `generate-image`.
 *
 * Vendor errors: any `AIError` is mapped to `{ ok: false, error: 'render_failed' }` (502),
 * with vendor `attempts` array attached for ops (NOT exposed to the client envelope keys,
 * but we do persist it in `renders.error`). `content_policy` becomes a separate 422 so the
 * UI can surface a softer "let's try slightly different wording" hint.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { session_id?: unknown; refinements?: unknown };
  try {
    body = (await req.json()) as { session_id?: unknown; refinements?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }
  const sessionId = body.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }

  // refinements is optional; if present, must be string[]
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

  // Budget check first — cheap SELECT, gives the user a clean 429 before they trip the slot.
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

    // Load ALL pet_photo assets (multi-photo reference is mandated by the spec).
    const photos = await db
      .select({ url: assets.publicUrl })
      .from(assets)
      .where(and(eq(assets.sessionId, sessionId), eq(assets.kind, 'pet_photo')));

    if (photos.length === 0) {
      slot.slot.releaseAndDontCount();
      committed = true;
      return errJson('no-photos', { status: 400 });
    }

    const sessionWire = serializeSession(auth.session);
    const { prompt, references } = buildCharacterSheetPrompt({
      session: sessionWire,
      photoUrls: photos.map((p) => p.url),
      refinements,
    });

    let result;
    try {
      result = await generateImage({
        prompt,
        references,
        size: '2048x2048',
        quality: 'high',
        aspectRatio: '1:1',
        sessionId,
        idempotencyKey: idempotencyKey ?? uuidv7(),
        stage: 'character_sheet',
      });
    } catch (err) {
      if (err instanceof AIError) {
        // Slot was used by a vendor call — count it even on failure (Bug-9 guidance: count
        // only on success; here we count because we did spend vendor work and want the hourly
        // cap to absorb a flapping-vendor case).
        slot.slot.commit();
        committed = true;
        console.error('[character-sheet.render] AIError', {
          code: err.code,
          attempts: err.attempts,
        });
        if (err.code === 'content_policy') {
          return errJson('content-policy-violation', { status: 422 });
        }
        // Don't leak vendor names through the envelope keys — `attempts` here describes the
        // shape, not the identity. (Ops sees the full chain via `renders.error`.)
        const respBody: Extract<CharacterSheetRenderResponse, { ok: false }> = {
          ok: false,
          error: 'render_failed',
        };
        return Response.json(respBody, { status: 502 });
      }
      throw err;
    }

    // Persist the S3-rehosted output as a `character_sheet` asset row.
    const assetId = uuidv7();
    // Extract the S3 key from the public URL — `getPublicUrl` is the inverse.
    const s3Key = extractS3KeyFromPublicUrl(result.url);

    await db.insert(assets).values({
      id: assetId,
      sessionId,
      kind: 'character_sheet',
      source: 'vendor_render',
      r2Key: s3Key,
      publicUrl: result.url,
      mimeType: 'image/png',
      metadata: {
        vendor_served: result.vendorServed,
        vendor_attempted: result.vendorAttempted,
        cost_usd_est: result.costUsdEst,
        duration_ms: result.durationMs,
        refinement_count: refinements.length,
      },
    });

    slot.slot.commit();
    committed = true;

    // `render_id` is the idempotency key the vendor-layer wrote into `renders.idempotency_key`
    // (or a fresh UUID if no header). The UI uses it to correlate retries.
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
 * The S3 wrapper exposes `getPublicUrl(key)` but no inverse — derive the key from the
 * `S3_PUBLIC_BASE_URL` prefix. Defensive: if the URL doesn't start with the configured
 * base, fall back to using the URL as-is (assets table accepts arbitrary strings, but the
 * lifecycle-purge path needs the key, so log loudly on mismatch).
 */
function extractS3KeyFromPublicUrl(url: string): string {
  const base = (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  if (base && url.startsWith(base + '/')) {
    return url.slice(base.length + 1);
  }
  console.warn('[character-sheet.render] S3 public URL did not match S3_PUBLIC_BASE_URL prefix', {
    url,
    base,
  });
  // Last-ditch: take the path after the last `/sessions/` segment.
  const idx = url.indexOf('/sessions/');
  if (idx >= 0) return url.slice(idx + 1);
  return url;
}
