import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import type { ResumeResponse } from '@/lib/builder/wire-types';
import type { StageTag } from '@/lib/builder/state';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { setSessionCookie } from '@/lib/session/cookie';
import { generateToken } from '@/lib/session/hmac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ token: string }> };

/**
 * POST /api/session/resume/[token]
 *
 * Exchange a resume token for a fresh cookie. The resume token is the auth — no cookie
 * required. We rotate BOTH the `cookie_token` AND the `resume_token` on success:
 *   - cookie_token rotation kicks any stale cookie from a prior device.
 *   - resume_token rotation closes the long-lived shareable-bearer hole (B6 in
 *     the pre-Phase-15 bug audit): once a resume link is used, the URL in
 *     someone's browser history / screenshot / forwarded email no longer
 *     grants access. The new resume token rides back in the response so the
 *     redeemer can re-bookmark.
 *
 * Wire shape (B4): returns `{ ok: true, session_id, stage, resume_token }`.
 */
export async function POST(_req: Request, ctx: RouteParams): Promise<Response> {
  const { token } = await ctx.params;
  if (!token) return errJson('invalid-input', { status: 400 });

  const db = getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.resumeToken, token)).limit(1);
  const row = rows[0];
  if (!row) return errJson('session-not-found', { status: 404 });

  // Rotate both tokens — the old cookie and the just-used resume link both
  // stop working after this point. The resume link is a 256-bit bearer with
  // no expiry on the DB side; rotating-on-use is the cheap fix to bound its
  // lifetime to a single redemption.
  const cookieToken = generateToken();
  const resumeToken = generateToken();
  const updated = await db
    .update(sessions)
    .set({ cookieToken, resumeToken, updatedAt: new Date() })
    .where(eq(sessions.id, row.id))
    .returning();
  const updatedRow = updated[0] ?? row;

  await setSessionCookie({ sessionId: updatedRow.id, cookieToken });

  const body: Omit<Extract<ResumeResponse, { ok: true }>, 'ok'> = {
    session_id: updatedRow.id,
    stage: updatedRow.stage as StageTag,
    resume_token: updatedRow.resumeToken,
  };
  return okJson(body as unknown as Record<string, unknown>);
}
