import 'server-only';

import { eq } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { sessions, type Session } from '@/lib/db/schema';

import { getSessionCookie } from './cookie';

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; status: 401 | 403 | 404; error: 'no-session' | 'cookie-mismatch' | 'session-not-found' };

/**
 * Resolve the active session for a request via the HMAC cookie:
 *   - no cookie → 401 no-session
 *   - cookie present, sessionId not in DB → 404 session-not-found
 *   - cookie present, DB row's cookie_token differs from cookie payload → 403 cookie-mismatch
 *
 * The optional `expectedSessionId` argument tightens the lookup when the route URL carries an
 * `[id]` segment — if the cookie claims a different session, fail with 403 rather than
 * silently authing as the wrong row.
 */
export async function authBySession(expectedSessionId?: string): Promise<AuthResult> {
  const cookie = await getSessionCookie();
  if (!cookie) return { ok: false, status: 401, error: 'no-session' };

  if (expectedSessionId && cookie.sessionId !== expectedSessionId) {
    return { ok: false, status: 403, error: 'cookie-mismatch' };
  }

  const db = getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.id, cookie.sessionId)).limit(1);
  const row = rows[0];
  if (!row) return { ok: false, status: 404, error: 'session-not-found' };

  if (row.cookieToken !== cookie.cookieToken) {
    return { ok: false, status: 403, error: 'cookie-mismatch' };
  }
  return { ok: true, session: row };
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
