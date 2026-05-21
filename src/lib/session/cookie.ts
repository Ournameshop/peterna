import 'server-only';

import { cookies } from 'next/headers';

import { signToken, verifyToken } from './hmac';

/**
 * Cookie name used to carry the HMAC-signed session token. `httponly`, `sameSite=lax`, 30-day
 * expiry per `api-routes.md`. The cookie payload is `<sessionId>:<cookieToken>` so the route
 * handler can both identify the session and match against the persisted cookie_token column.
 */
export const SESSION_COOKIE_NAME = 'peterna_session';
const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type SessionCookiePayload = {
  sessionId: string;
  cookieToken: string;
};

function encodePayload(p: SessionCookiePayload): string {
  return `${p.sessionId}:${p.cookieToken}`;
}

function decodePayload(payload: string): SessionCookiePayload | null {
  const idx = payload.indexOf(':');
  if (idx <= 0 || idx === payload.length - 1) return null;
  const sessionId = payload.slice(0, idx);
  const cookieToken = payload.slice(idx + 1);
  if (!sessionId || !cookieToken) return null;
  return { sessionId, cookieToken };
}

/**
 * Set the session cookie on the outgoing response. Call from any Route Handler that mutates
 * session ownership (create, resume). Uses Next 16's async `cookies()` accessor.
 */
export async function setSessionCookie(payload: SessionCookiePayload): Promise<void> {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE_NAME,
    value: signToken(encodePayload(payload)),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

/** Clear the session cookie (used by DELETE /api/session/[id]). */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

/**
 * Read + HMAC-verify the session cookie. Returns null if missing / tampered. Does *not* check
 * that the cookie_token matches the DB row — that's the caller's job (the DB lookup gives
 * forward-secrecy on stolen cookies via rotation).
 */
export async function getSessionCookie(): Promise<SessionCookiePayload | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  if (!value) return null;
  const payload = verifyToken(value);
  if (!payload) return null;
  return decodePayload(payload);
}
