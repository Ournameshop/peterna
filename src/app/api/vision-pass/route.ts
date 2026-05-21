import { and, eq } from 'drizzle-orm';

import { runVisionPass } from '@/lib/ai/run-vision-pass';
import { AIError } from '@/lib/ai/types';
import { errJson, okJson } from '@/lib/api/respond';
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
 * Body: `{ sessionId: string }`. Pulls all `assets` of kind `'pet_photo'` for the session,
 * composes the prompt by substituting `[PET_NAME]` (or "your pet" if not yet captured), calls
 * `runVisionPass()`, then persists the structured `inferred_profile` + `inferred_confidence`
 * back to the session row.
 *
 * Per `api-routes.md`: on `AIError` we return `{ ok: true, vision_failure: true }` (200) — the
 * failure path is a UX state, not a transport error, so the UI knows to degrade to the v0.7
 * explicit-question flow. We do *not* leak vendor names through the response; the
 * `attempts[]` array stays in `renders.error` for ops.
 *
 * Idempotency: the per-session slot lock keeps double-taps from racing into two parallel
 * vendor calls. The unique index on `renders(session_id, stage, idempotency_key)` is what
 * Phase-2 render routes will lean on — vision-pass currently uses a fresh UUID per call.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { sessionId?: unknown };
  try {
    body = (await req.json()) as { sessionId?: unknown };
  } catch {
    return errJson('invalid-input', { status: 400 });
  }
  const sessionId = body.sessionId;
  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'sessionId' } });
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

  try {
    const db = getDb();

    const photos = await db
      .select({ url: assets.publicUrl })
      .from(assets)
      .where(and(eq(assets.sessionId, sessionId), eq(assets.kind, 'pet_photo')));

    if (photos.length === 0) {
      return errJson('invalid-input', { status: 400, details: { field: 'photos', message: 'no pet_photo assets for session' } });
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
      });
    } catch (err) {
      if (err instanceof AIError) {
        // UX state, not a transport error — surface to the client as a soft failure.
        console.error('[vision-pass] AIError', { code: err.code, attempts: err.attempts });
        return okJson({ vision_failure: true });
      }
      throw err;
    }

    // Spec escape hatch: model emitted `{ vision_failure: true }` — propagate without writing
    // a (non-)profile to the session.
    if ((result.profile as { vision_failure?: boolean }).vision_failure) {
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

    return okJson({ profile: result.profile, confidence: result.confidence });
  } finally {
    slot.release();
  }
}
