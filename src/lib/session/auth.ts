import 'server-only';

import { eq } from 'drizzle-orm';

import { readUserIdFromCookie } from '@/lib/auth/user-cookie';
import { getDb } from '@/lib/db/client';
import { sessions, type Session } from '@/lib/db/schema';

import { getSessionCookie, setSessionCookie } from './cookie';

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; status: 401 | 403 | 404; error: 'no-session' | 'cookie-mismatch' | 'session-not-found' };

/**
 * Resolve the active session for a request:
 *
 *   1. Try the HMAC `peterna_session` cookie first (normal anonymous + signed-in path).
 *   2. If that fails for ANY reason (no cookie, wrong session, wrong cookie_token) AND the
 *      request carries a valid `auth_user` cookie AND the requested session belongs to that
 *      user (`sessions.user_id = userId`), succeed AND silently re-issue the
 *      `peterna_session` cookie so subsequent requests don't need this recovery path.
 *
 *      This is what makes the dashboard "Open" flow work: a signed-in user returning to a
 *      session they own should not get 403 cookie-mismatch on every PATCH just because their
 *      browser's session cookie is stale or absent. Ownership via `auth_user` is enough.
 *
 *   3. Otherwise return the original failure code (preserving the 401/403/404 semantics for
 *      anonymous / hostile callers).
 */
export async function authBySession(expectedSessionId?: string): Promise<AuthResult> {
  const cookie = await getSessionCookie();
  const cookieOk =
    cookie &&
    (!expectedSessionId || cookie.sessionId === expectedSessionId);

  if (cookieOk) {
    const db = getDb();
    const rows = await db.select().from(sessions).where(eq(sessions.id, cookie.sessionId)).limit(1);
    const row = rows[0];
    if (row && row.cookieToken === cookie.cookieToken) {
      return { ok: true, session: row };
    }
  }

  // User-owned recovery — only applies when a specific session was requested and the user
  // owns it. Anonymous callers (no auth_user cookie) fall through to the original failure.
  if (expectedSessionId) {
    const userId = await readUserIdFromCookie();
    if (userId) {
      const db = getDb();
      const rows = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, expectedSessionId))
        .limit(1);
      const row = rows[0];
      if (row && row.userId === userId) {
        // Rebind the peterna_session cookie so the browser carries the right
        // (sessionId, cookieToken) on the next request.
        await setSessionCookie({ sessionId: row.id, cookieToken: row.cookieToken });
        return { ok: true, session: row };
      }
    }
  }

  // Reproduce the original failure-code semantics for callers that distinguish them.
  if (!cookie) return { ok: false, status: 401, error: 'no-session' };
  if (expectedSessionId && cookie.sessionId !== expectedSessionId) {
    return { ok: false, status: 403, error: 'cookie-mismatch' };
  }
  const db = getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.id, cookie.sessionId)).limit(1);
  const row = rows[0];
  if (!row) return { ok: false, status: 404, error: 'session-not-found' };
  return { ok: false, status: 403, error: 'cookie-mismatch' };
}

/** Lookup by resume token (used by /api/session/resume/[token] and ?resume=). */
export async function authByResumeToken(token: string): Promise<AuthResult> {
  if (!token) return { ok: false, status: 401, error: 'no-session' };
  const db = getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.resumeToken, token)).limit(1);
  const row = rows[0];
  if (!row) return { ok: false, status: 404, error: 'session-not-found' };
  return { ok: true, session: row };
}
