import { and, eq, isNull } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import {
  consumeMagicLinkToken,
  findOrCreateUser,
} from '@/lib/auth/magic-link';
import { setUserCookie } from '@/lib/auth/user-cookie';
import type { UserWire } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { sessions, type User } from '@/lib/db/schema';
import { getSessionCookie } from '@/lib/session/cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/magic-link/consume?token=<raw>
 *
 * Validates the raw token, finds-or-creates the user, sets the `auth_user`
 * cookie, and (if the request also carries a `peterna_session` cookie for an
 * anonymous session) attaches that session to the user.
 *
 * Returns JSON `{ ok, user, redirect_to }`; the `/auth/callback` page does
 * the actual navigation. We don't 302 from here so an XHR caller (e.g. the
 * frontend's silent retry path) can read the result.
 *
 * `redirect_to` heuristic:
 *   - If we linked an in-progress session, go to that builder.
 *   - Otherwise, send the user to `/dashboard`. The frontend can decide to
 *     bounce them onward if no tributes exist.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return errJson('invalid-input', { status: 400, details: { field: 'token' } });
  }

  const consumed = await consumeMagicLinkToken(token);
  if (!consumed.ok) {
    const errorMap = {
      'not-found': 'token-not-found',
      consumed: 'token-consumed',
      expired: 'token-expired',
    } as const;
    return errJson(errorMap[consumed.reason], { status: 400 });
  }

  const user = await findOrCreateUser(consumed.email);
  await setUserCookie(user.id);

  // Try to link an existing anonymous session. We only link if it's still
  // unowned (`user_id IS NULL`) — never steal a session already attached to
  // another user (defensive against weird stale-cookie scenarios).
  const linkedSessionId = await tryLinkAnonymousSession(user.id);

  const redirectTo = linkedSessionId ? '/builder' : '/dashboard';

  const userWire: UserWire = {
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.createdAt.toISOString(),
    email_verified_at: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
  };

  return okJson({ user: userWire, redirect_to: redirectTo });
}

/**
 * If the request carries a valid anonymous `peterna_session` cookie pointing
 * at a session with `user_id IS NULL`, set `user_id = <user.id>`. Returns
 * the session id we attached, or null if nothing to link.
 *
 * The cookie is *trusted* here — we don't verify `cookie_token` against the
 * row because owning the cookie + a verified magic link is sufficient
 * authority to claim the session. (The cookie itself is HMAC-signed.)
 */
async function tryLinkAnonymousSession(userId: User['id']): Promise<string | null> {
  const cookie = await getSessionCookie();
  if (!cookie) return null;

  const db = getDb();
  const updated = await db
    .update(sessions)
    .set({ userId, updatedAt: new Date() })
    .where(and(eq(sessions.id, cookie.sessionId), isNull(sessions.userId)))
    .returning({ id: sessions.id });
  return updated[0]?.id ?? null;
}
