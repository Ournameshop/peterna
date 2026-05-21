import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { getDb } from '@/lib/db/client';
import { sessions, type Session } from '@/lib/db/schema';
import { setSessionCookie } from '@/lib/session/cookie';
import { generateToken } from '@/lib/session/hmac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ token: string }> };

/**
 * POST /api/session/resume/[token]
 *
 * Exchange a resume token for a fresh cookie. The resume token is the auth — no cookie
 * required. We rotate the `cookie_token` on success so a stale cookie left over from a prior
 * device stops working (the resume link is the only canonical pointer back to a session).
 */
export async function POST(_req: Request, ctx: RouteParams): Promise<Response> {
  const { token } = await ctx.params;
  if (!token) return errJson('invalid-input', { status: 400 });

  const db = getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.resumeToken, token)).limit(1);
  const row = rows[0];
  if (!row) return errJson('session-not-found', { status: 404 });

  // Rotate the cookie token so any prior device's cookie is now invalid.
  const cookieToken = generateToken();
  const updated = await db
    .update(sessions)
    .set({ cookieToken, updatedAt: new Date() })
    .where(eq(sessions.id, row.id))
    .returning();
  const updatedRow = updated[0] ?? row;

  await setSessionCookie({ sessionId: updatedRow.id, cookieToken });

  return okJson({ session: serializeSession(updatedRow) });
}

function serializeSession(s: Session): Session {
  return s;
}
