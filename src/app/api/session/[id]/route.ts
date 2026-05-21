import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

import { errJson, okJson } from '@/lib/api/respond';
import {
  isStageTag,
  legalNextStages,
  type StageTag,
} from '@/lib/builder/state';
import { serializeSession } from '@/lib/builder/serialize';
// Note: this route's allowlist mirrors `SessionPatchBody` in
// `src/lib/builder/wire-types.ts`. Every key in `STRING_FIELDS` /
// `ARRAY_FIELDS` / `INT_FIELDS` / `BOOL_FIELDS` / `JSON_FIELDS` below must
// appear there, and vice versa — that is the contract test the type system
// can't enforce statically (because PATCH is value-typed at the boundary).
import { getDb } from '@/lib/db/client';
import { assets, sessions } from '@/lib/db/schema';
import { authBySession, authByResumeToken } from '@/lib/session/auth';
import { clearSessionCookie } from '@/lib/session/cookie';
import { deleteObjects } from '@/lib/storage/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/session/[id] — returns the full session JSON.
 * Auth: cookie OR `?resume=<token>`. If `?resume=` is supplied, the token is the auth — no
 * cookie required (mirrors `api-routes.md`'s "shareable resume links" semantic).
 */
export async function GET(req: NextRequest, ctx: RouteParams): Promise<Response> {
  const { id } = await ctx.params;
  const resume = req.nextUrl.searchParams.get('resume');

  if (resume) {
    const auth = await authByResumeToken(resume);
    if (!auth.ok) return errJson(auth.error, { status: auth.status });
    if (auth.session.id !== id) return errJson('cookie-mismatch', { status: 403 });
    return okJson({ session: serializeSession(auth.session) });
  }

  const auth = await authBySession(id);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });
  return okJson({ session: serializeSession(auth.session) });
}

/**
 * PATCH /api/session/[id] — apply an intake-field update.
 *
 * Wire shape: snake_case keys per `src/lib/builder/wire-types.ts#SessionPatchBody`. Server
 * maps each allowlisted field to its Drizzle camelCase setter via `WIRE_TO_DRIZZLE` below.
 *
 * State-machine guard (B5): when `stage` is in the body, validate the transition against
 * `reduceState` via `legalNextStages(current)`. Illegal transitions return 400
 * `invalid-stage-transition` so a buggy or malicious client can't skip ahead. Same-stage
 * PATCHes are always legal (idempotent).
 */
export async function PATCH(req: NextRequest, ctx: RouteParams): Promise<Response> {
  const { id } = await ctx.params;
  const auth = await authBySession(id);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errJson('invalid-input', { status: 400, details: { issues: [{ message: 'json parse failed' }] } });
  }

  const patch = pickAllowed(body);
  const issues = validatePatch(patch);
  if (issues.length > 0) {
    return errJson('invalid-input', { status: 400, details: { issues } });
  }

  // State-machine transition validation (B5 + Bug-6).
  // - Stage must be a known tag (Bug-6: reject `lol_eaten_by_a_dragon`).
  // - Target must be reachable from the current stage via at least one reducer event;
  //   same-stage is always legal (idempotent PATCH).
  if ('stage' in patch) {
    const nextStage = patch.stage as string;
    if (!isStageTag(nextStage)) {
      return errJson('invalid-input', { status: 400, details: { field: 'stage', message: 'unknown stage tag' } });
    }
    const currentStage = auth.session.stage as StageTag;
    if (nextStage !== currentStage) {
      const legal = legalNextStages(currentStage);
      if (!legal.has(nextStage)) {
        return errJson('invalid-stage-transition', {
          status: 400,
          details: { from: currentStage, to: nextStage },
        });
      }
    }
  }

  const db = getDb();
  const update: Record<string, unknown> = { ...mapToDrizzle(patch), updatedAt: new Date() };

  const rows = await db.update(sessions).set(update).where(eq(sessions.id, id)).returning();
  const updated = rows[0];
  if (!updated) return errJson('session-not-found', { status: 404 });

  return okJson({ session: serializeSession(updated) });
}

/**
 * DELETE /api/session/[id] — cascades the DB rows AND the S3 objects under
 * `sessions/<id>/`. The DB cascade is via the FK `assets.session_id` ON DELETE CASCADE, but S3
 * doesn't know about Postgres — so we list and delete-objects in batches of 1000 first, then
 * drop the sessions row.
 *
 * Bug-1: wrap each batch in try/catch. S3 throw modes (throttling, partial-delete, network)
 * should NOT block the DB delete + cookie clear — the lifecycle rule in `data-model.md`
 * §"Lifecycle / retention" sweeps stragglers within 30 days. We log the affected keys so
 * ops can spot-check; the UX is what we're protecting here.
 */
export async function DELETE(req: NextRequest, ctx: RouteParams): Promise<Response> {
  const { id } = await ctx.params;
  const auth = await authBySession(id);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const db = getDb();

  // Collect the asset keys we know about from the DB. This is the load-bearing list — the
  // S3 lifecycle rule will sweep anything we miss within 30 days.
  const keyRows = await db.select({ key: assets.r2Key }).from(assets).where(eq(assets.sessionId, id));
  const keys = keyRows.map((r) => r.key);

  // Delete in batches of 1000 (the AWS S3 DeleteObjects API limit).
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    try {
      await deleteObjects({ keys: batch });
    } catch (err) {
      // Don't fail the route — let the DB delete + cookie clear proceed; the S3 lifecycle
      // rule sweeps within 30 days. See data-model.md §"Lifecycle / retention".
      console.warn('[session.delete] S3 deleteObjects failed; proceeding with DB delete', {
        sessionId: id,
        batchSize: batch.length,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await db.delete(sessions).where(eq(sessions.id, id));

  await clearSessionCookie();

  return okJson({});
}

// ----------------------------------------------------------------------------
// Allowlist (snake_case wire fields → drizzle camelCase setters)
// ----------------------------------------------------------------------------

// The allowlist is the source of truth for what a PATCH can write. Any field added
// here must also appear in `SessionPatchBody` at `src/lib/builder/wire-types.ts` so
// the frontend's TypeScript catches drift.
//
// Phase 3 exception: `combination_preview_asset_id` is allowlisted here for a
// defensive recovery path (per the Phase 3 task brief). `wire-types.ts` is frozen
// for Phase 3 so the typed wire surface intentionally omits the field — the
// canonical writer remains `/api/preview/approve`. Re-sync the wire-types when
// Phase 3 lands.
const STRING_FIELDS = [
  'stage',
  'pet_name',
  'pet_name_pronunciation',
  'pet_gender',
  'relationship',
  'memory_prompt_type',
  'memory_prompt_answer',
  'creator_name',
  'years_label',
  'aspect_ratio',
  'curators_pick_id',
  'format_id',
  'theme_id',
  'style_id',
  // Phase 3: defensively writable via PATCH so a recovery path exists if the
  // approve route fails mid-update. Canonical writer is /api/preview/approve.
  'combination_preview_asset_id',
] as const;

const ARRAY_FIELDS = ['personality_traits', 'favorite_things'] as const;
const INT_FIELDS = ['beat_count', 'target_minutes'] as const;
const BOOL_FIELDS = ['is_returning_user'] as const;
const JSON_FIELDS = ['inferred_profile'] as const;

// Snake-case wire keys → camelCase drizzle setters.
const WIRE_TO_DRIZZLE: Record<string, string> = {
  stage: 'stage',
  pet_name: 'petName',
  pet_name_pronunciation: 'petNamePronunciation',
  pet_gender: 'petGender',
  relationship: 'relationship',
  memory_prompt_type: 'memoryPromptType',
  memory_prompt_answer: 'memoryPromptAnswer',
  creator_name: 'creatorName',
  years_label: 'yearsLabel',
  aspect_ratio: 'aspectRatio',
  curators_pick_id: 'curatorsPickId',
  format_id: 'formatId',
  theme_id: 'themeId',
  style_id: 'styleId',
  combination_preview_asset_id: 'combinationPreviewAssetId',
  personality_traits: 'personalityTraits',
  favorite_things: 'favoriteThings',
  beat_count: 'beatCount',
  target_minutes: 'targetMinutes',
  is_returning_user: 'returningUser',
  inferred_profile: 'inferredProfile',
};

function pickAllowed(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of STRING_FIELDS) if (k in body) out[k] = body[k];
  for (const k of ARRAY_FIELDS) if (k in body) out[k] = body[k];
  for (const k of INT_FIELDS) if (k in body) out[k] = body[k];
  for (const k of BOOL_FIELDS) if (k in body) out[k] = body[k];
  for (const k of JSON_FIELDS) if (k in body) out[k] = body[k];
  return out;
}

function mapToDrizzle(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [wireKey, value] of Object.entries(patch)) {
    const drizzleKey = WIRE_TO_DRIZZLE[wireKey];
    if (drizzleKey) out[drizzleKey] = value;
  }
  return out;
}

function validatePatch(patch: Record<string, unknown>): Array<{ field: string; message: string }> {
  const issues: Array<{ field: string; message: string }> = [];
  for (const k of STRING_FIELDS) {
    if (k in patch && patch[k] != null && typeof patch[k] !== 'string') {
      issues.push({ field: k, message: 'expected string' });
    }
  }
  for (const k of ARRAY_FIELDS) {
    if (k in patch && patch[k] != null) {
      const v = patch[k];
      if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
        issues.push({ field: k, message: 'expected string[]' });
      }
    }
  }
  for (const k of INT_FIELDS) {
    if (k in patch && patch[k] != null) {
      const v = patch[k];
      if (typeof v !== 'number' || !Number.isInteger(v)) {
        issues.push({ field: k, message: 'expected integer' });
      }
    }
  }
  for (const k of BOOL_FIELDS) {
    if (k in patch && patch[k] != null && typeof patch[k] !== 'boolean') {
      issues.push({ field: k, message: 'expected boolean' });
    }
  }
  for (const k of JSON_FIELDS) {
    if (k in patch && patch[k] != null) {
      const v = patch[k];
      if (typeof v !== 'object' || Array.isArray(v)) {
        issues.push({ field: k, message: 'expected object' });
      }
    }
  }
  return issues;
}

// Session row → wire JSON: see `serializeSession` in `@/lib/builder/serialize`.
