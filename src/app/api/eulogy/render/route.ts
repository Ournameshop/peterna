import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { errJson, okJson } from '@/lib/api/respond';
import { renderEulogyPdf } from '@/lib/eulogy/render';
import { getDb } from '@/lib/db/client';
import { assets, sessions } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';
import { acquireSessionSlot } from '@/lib/session/rate-limit';
import { getPublicUrl, uploadObject } from '@/lib/storage/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/eulogy/render (Stage 8 — Eulogy PDF)
 *
 * Body: `EulogyRenderRequest` — `{ session_id }`.
 *
 * Preconditions:
 *   - `assembled_video_asset_id` must be non-null (Phase 7 done).
 *   - `pet_name` must be set (Stage 1.3).
 *
 * Process:
 *   1. Fetch the character sheet bytes from S3 (best-effort; the PDF renders
 *      without the vignette if the fetch fails or the asset row is missing).
 *   2. Compose the PDF via `renderEulogyPdf` — pure server-side react-pdf,
 *      no vendor call.
 *   3. Upload to S3 at `sessions/<id>/eulogy/<uuid>.pdf`, insert an `assets`
 *      row `kind='eulogy_pdf'`, persist `eulogy_pdf_asset_id` on the session.
 *   4. Advance `stage` to `eulogy_review` so the FE can show the gate.
 *
 * Returns `{ asset_id, public_url }`.
 *
 * Rate-limit posture: the 1-in-flight session slot guards against runaway
 * re-renders; the PDF render itself costs $0 vendor but ~2-5s CPU.
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

  const session = auth.session;

  if (!session.assembledVideoAssetId) {
    return errJson('incomplete-tribute', {
      status: 400,
      details: { reason: 'no-assembled-video' },
    });
  }
  if (!session.petName) {
    return errJson('incomplete-tribute', {
      status: 400,
      details: { reason: 'no-pet-name' },
    });
  }

  const slot = acquireSessionSlot(sessionId);
  if (!slot.ok) {
    if (slot.reason === 'in_flight') {
      return errJson('render-in-flight', { status: 409, headers: { 'Retry-After': '5' } });
    }
    return errJson('session-budget-exceeded', { status: 429 });
  }

  let committed = false;
  try {
    const db = getDb();

    // Fetch character-sheet bytes (best-effort).
    let characterSheetBytes: Buffer | null = null;
    let characterSheetMime: string | null = null;
    if (session.characterSheetAssetId) {
      const rows = await db
        .select({
          publicUrl: assets.publicUrl,
          mimeType: assets.mimeType,
          sessionId: assets.sessionId,
          kind: assets.kind,
        })
        .from(assets)
        .where(eq(assets.id, session.characterSheetAssetId))
        .limit(1);
      const row = rows[0];
      if (row && row.sessionId === sessionId && row.kind === 'character_sheet') {
        try {
          const fetched = await fetch(row.publicUrl);
          if (fetched.ok) {
            characterSheetBytes = Buffer.from(await fetched.arrayBuffer());
            characterSheetMime = row.mimeType ?? null;
          } else {
            console.warn('[eulogy.render] character sheet fetch non-ok', {
              session_id: sessionId,
              status: fetched.status,
            });
          }
        } catch (err) {
          console.warn('[eulogy.render] character sheet fetch threw', {
            session_id: sessionId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Idempotency-Key for the renders row. Prefer the header (so a client
    // retry collapses to a single row via the schema's unique index); fall
    // back to a fresh UUID per request.
    const idempotencyKey =
      req.headers.get('idempotency-key')?.trim() || randomUUID();

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderEulogyPdf({
        session: {
          pet_name: session.petName,
          years_label: session.yearsLabel,
          creator_name: session.creatorName,
          memory_prompt_answer: session.memoryPromptAnswer,
          personality_traits: session.personalityTraits ?? null,
          favorite_things: session.favoriteThings ?? null,
        },
        characterSheetBytes,
        characterSheetMime,
        openingText: session.openingTitleCardText,
        closingText: session.closingCardText,
        sessionId,
        idempotencyKey,
      });
    } catch (err) {
      slot.slot.commit();
      committed = true;
      console.error('[eulogy.render] react-pdf renderToBuffer failed', {
        session_id: sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
      return errJson('render_failed', { status: 500 });
    }

    const pdfUuid = uuidv7();
    const s3Key = `sessions/${sessionId}/eulogy/${pdfUuid}.pdf`;
    await uploadObject({
      key: s3Key,
      body: pdfBuffer,
      contentType: 'application/pdf',
    });
    const publicUrl = getPublicUrl(s3Key);

    const eulogyAssetId = uuidv7();
    await db.insert(assets).values({
      id: eulogyAssetId,
      sessionId,
      kind: 'eulogy_pdf',
      source: 'eulogy_render',
      r2Key: s3Key,
      publicUrl,
      mimeType: 'application/pdf',
      bytes: pdfBuffer.length,
      metadata: {
        has_character_sheet: Boolean(characterSheetBytes),
        has_opening_text: Boolean(session.openingTitleCardText),
        has_closing_text: Boolean(session.closingCardText),
      },
    });

    await db
      .update(sessions)
      .set({
        eulogyPdfAssetId: eulogyAssetId,
        // Phase 8 review stage. The FE state machine (owned by the frontend
        // agent) adds `eulogy_review` alongside `eulogy_pdf` in the same
        // slice; until that lands, this string is written directly because
        // the column is `text`, not a Drizzle enum.
        stage: 'eulogy_review',
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    slot.slot.commit();
    committed = true;

    return okJson({ asset_id: eulogyAssetId, public_url: publicUrl });
  } finally {
    if (!committed) slot.slot.releaseAndDontCount();
  }
}
