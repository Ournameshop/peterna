import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

import { errJson, okJson } from '@/lib/api/respond';
import { getDb } from '@/lib/db/client';
import { assets, sessions, type Session } from '@/lib/db/schema';
import { authBySession, authByResumeToken } from '@/lib/session/auth';
import { clearSessionCookie } from '@/lib/session/cookie';
import { deleteObjects } from '@/lib/storage/r2';

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
 * Phase 1 implements field validation against an allowlist; the full state-machine transition
 * guard from `src/lib/builder/state.ts` is the frontend agent's territory. We refuse stage
 * transitions to anything the state machine doesn't know about ourselves once that module
 * lands; for now we accept the `stage` field as a string and trust the caller (the state
 * machine on the client is the source of truth in Phase 1, by design — see the note in
 * `phase-plan.md` Phase 1 ¶ "state machine reused server-side by PATCH").
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

  const db = getDb();
  const update: Record<string, unknown> = { ...patch, updatedAt: new Date() };

  const rows = await db.update(sessions).set(update).where(eq(sessions.id, id)).returning();
  const updated = rows[0];
  if (!updated) return errJson('session-not-found', { status: 404 });

  return okJson({ session: serializeSession(updated) });
}

/**
 * DELETE /api/session/[id] — cascades the DB rows AND the R2 objects under
 * `sessions/<id>/`. The DB cascade is via the FK `assets.session_id` ON DELETE CASCADE, but R2
 * doesn't know about Postgres — so we list and delete-objects in batches of 1000 first, then
 * drop the sessions row.
 */
export async function DELETE(req: NextRequest, ctx: RouteParams): Promise<Response> {
  const { id } = await ctx.params;
  const auth = await authBySession(id);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const db = getDb();

  // Collect the asset keys we know about from the DB. This is the load-bearing list — the
  // R2 lifecycle rule will sweep anything we miss within 30 days.
  const keyRows = await db.select({ key: assets.r2Key }).from(assets).where(eq(assets.sessionId, id));
  const keys = keyRows.map((r) => r.key);

  // Delete in batches of 1000 (the AWS limit and S3-compat target).
  for (let i = 0; i < keys.length; i += 1000) {
    await deleteObjects({ keys: keys.slice(i, i + 1000) });
  }

  await db.delete(sessions).where(eq(sessions.id, id));

  await clearSessionCookie();

  return okJson({});
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const STRING_FIELDS = [
  'stage',
  'petName',
  'petNamePronunciation',
  'petGender',
  'relationship',
  'memoryPromptType',
  'memoryPromptAnswer',
  'creatorName',
  'yearsLabel',
  'aspectRatio',
  'curatorsPickId',
  'formatId',
  'themeId',
  'styleId',
] as const;

const ARRAY_FIELDS = ['personalityTraits', 'favoriteThings'] as const;
const INT_FIELDS = ['beatCount', 'targetMinutes'] as const;
const BOOL_FIELDS = ['returningUser'] as const;

function pickAllowed(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of STRING_FIELDS) if (k in body) out[k] = body[k];
  for (const k of ARRAY_FIELDS) if (k in body) out[k] = body[k];
  for (const k of INT_FIELDS) if (k in body) out[k] = body[k];
  for (const k of BOOL_FIELDS) if (k in body) out[k] = body[k];
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
  return issues;
}

/**
 * The session row is safe to ship as-is — `cookie_token` is included by design (the cookie
 * already authoritatively owns it; the client never reads it back). If we want to redact it in
 * a future revision, this is the one place to do it.
 */
function serializeSession(s: Session): Session {
  return s;
}
