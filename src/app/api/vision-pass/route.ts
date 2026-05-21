import { and, eq } from 'drizzle-orm';

import { runVisionPass } from '@/lib/ai/run-vision-pass';
import { AIError } from '@/lib/ai/types';
import { errJson, okJson } from '@/lib/api/respond';
import type { VisionPassResponse } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { assets, sessions } from '@/lib/db/schema';
import { PET_PROFILE_SCHEMA, VISION_PASS_PROMPT } from '@/lib/library/vision-pass';
import { authBySession } from '@/lib/session/auth';
import { acquireSessionSlot } from '@/lib/session/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * POST /api/vision-pass
 *
 * Body: `{ session_id: string }` (snake_case, per `wire-types.ts`). Pulls all `assets` of
 * kind `'pet_photo'` for the session, composes the prompt by substituting `[PET_NAME]` (or
 * "your pet" if not yet captured), calls `runVisionPass()`, then persists the structured
 * `inferred_profile` + `inferred_confidence` back to the session row.
 *
 * Per `api-routes.md`: on `AIError` we return `{ ok: true, vision_failure: true }` (200) — the
 * failure path is a UX state, not a transport error, so the UI knows to degrade to the v0.7
 * explicit-question flow. We do *not* leak vendor names through the response; the
 * `attempts[]` array stays in `renders.error` for ops.
 *
 * B2: success shape is `{ ok: true, inferred_profile, inferred_confidence }` — snake_case,
 * matches the DB column names and the spec at `api-routes.md`.
 *
 * Bug-5: read the `Idempotency-Key` request header (UUID v7) and thread it through to
 * `runVisionPass`. The DB unique index on `renders(session_id, stage, idempotency_key)`
 * short-circuits duplicates inside the 60s dedup window. Without a header, a fresh UUID is
 * minted — no dedup, but the insert still succeeds.
 *
 * Bug-9: the per-session slot's hourly counter is only committed when the vendor actually
 * succeeded. Early-bailout cases (no photos uploaded yet, etc.) release the in-flight token
 * without incrementing the count, so a user's mistaps don't lock them out for an hour.
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

  const slot = acquireSessionSlot(sessionId);
  if (!slot.ok) {
    if (slot.reason === 'in_flight') {
      return errJson('render-in-flight', { status: 409, headers: { 'Retry-After': '5' } });
    }
    return errJson('session-budget-exceeded', { status: 429 });
  }

  // Bug-5: pass through the client-supplied Idempotency-Key, if any.
  const idempotencyKey = req.headers.get('idempotency-key') ?? undefined;

  let committed = false;
  try {
    const db = getDb();

    const photos = await db
      .select({ url: assets.publicUrl })
      .from(assets)
      .where(and(eq(assets.sessionId, sessionId), eq(assets.kind, 'pet_photo')));

    if (photos.length === 0) {
      // Bug-9: don't burn an hourly-cap slot on a user who hasn't uploaded yet.
      slot.slot.releaseAndDontCount();
      committed = true;
      return errJson('invalid-input', {
        status: 400,
        details: { field: 'photos', message: 'no pet_photo assets for session' },
      });
    }

    const petName = auth.session.petName?.trim() || 'your pet';
    const prompt = VISION_PASS_PROMPT.replace(/\[PET_NAME\]/g, petName);

    let result;
    try {
      result = await runVisionPass({
        photos: photos.map((p) => p.url),
        schema: PET_PROFILE_SCHEMA as unknown as object,
        sessionId,
        prompt,
        idempotencyKey,
      });
    } catch (err) {
      if (err instanceof AIError) {
        // UX state, not a transport error — surface to the client as a soft failure.
        // Vendor names stay in renders.error for ops; the envelope itself is opaque.
        console.error('[vision-pass] AIError', { code: err.code, attempts: err.attempts });
        slot.slot.commit();
        committed = true;
        const failureBody: Extract<VisionPassResponse, { vision_failure: true }> = {
          ok: true,
          vision_failure: true,
        };
        return okJson({ vision_failure: failureBody.vision_failure });
      }
      throw err;
    }

    // Spec escape hatch: model emitted `{ vision_failure: true }` — propagate without writing
    // a (non-)profile to the session.
    if ((result.profile as { vision_failure?: boolean }).vision_failure) {
      slot.slot.commit();
      committed = true;
      return okJson({ vision_failure: true });
    }

    await db
      .update(sessions)
      .set({
        inferredProfile: result.profile,
        inferredConfidence: result.confidence,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    slot.slot.commit();
    committed = true;

    return okJson({
      inferred_profile: result.profile,
      inferred_confidence: result.confidence,
    });
  } finally {
    // Defensive: if we threw before committing/releasing, release without counting.
    if (!committed) slot.slot.releaseAndDontCount();
  }
}
