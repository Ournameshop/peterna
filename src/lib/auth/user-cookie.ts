import 'server-only';

import { cookies } from 'next/headers';

import { signToken, verifyToken } from '@/lib/session/hmac';

/**
 * `auth_user` cookie — mirrors the `peterna_session` (anonymous builder cookie)
 * pattern at `src/lib/session/cookie.ts` but encodes a verified user identity
 * instead of a session row. Independent cookie so the two flows are decoupled:
 *
 *   - Anonymous user → only `peterna_session` is set.
 *   - Signed-in user (no in-progress build) → only `auth_user` is set.
 *   - Signed-in user mid-build → both are set; the builder route reads the
 *     session cookie for state, and may read this one to link `sessions.user_id`.
 *
 * Payload is `<userId>|<expiresAtMs>`; the expiry is encoded inside the HMAC
 * payload (not just on the cookie attribute) so a stolen pre-expiry cookie
 * still expires server-side. httpOnly + sameSite=lax + 30-day rolling expiry.
 */
export const AUTH_USER_COOKIE_NAME = 'auth_user';
const AUTH_USER_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const AUTH_USER_COOKIE_MAX_AGE_MS = AUTH_USER_COOKIE_MAX_AGE_SECONDS * 1000;
const SEPARATOR = '|';

type AuthUserPayload = {
  userId: string;
  expiresAt: number; // ms since epoch
};

function encode(p: AuthUserPayload): string {
  return `${p.userId}${SEPARATOR}${p.expiresAt}`;
}

function decode(payload: string): AuthUserPayload | null {
  const idx = payload.indexOf(SEPARATOR);
  if (idx <= 0 || idx === payload.length - 1) return null;
  const userId = payload.slice(0, idx);
  const expiresStr = payload.slice(idx + 1);
  const expiresAt = Number(expiresStr);
  if (!userId || !Number.isFinite(expiresAt) || expiresAt <= 0) return null;
  return { userId, expiresAt };
}

/**
 * Set the `auth_user` cookie. Called from `/api/auth/magic-link/consume` after
 * a token is successfully redeemed. The 30-day max-age is a rolling window —
 * callers can refresh it at any auth-touching route by calling this again.
 */
export async function setUserCookie(userId: string): Promise<void> {
  const expiresAt = Date.now() + AUTH_USER_COOKIE_MAX_AGE_MS;
  const value = signToken(encode({ userId, expiresAt }));
  const store = await cookies();
  store.set({
    name: AUTH_USER_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AUTH_USER_COOKIE_MAX_AGE_SECONDS,
  });
}

/** Clear the cookie — used by `/api/auth/signout`. */
export async function clearUserCookie(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_USER_COOKIE_NAME);
}

/**
 * Read the `auth_user` cookie and return the user id if the cookie is valid
 * AND not yet expired (per the HMAC-signed payload). Returns null for any
 * failure mode — callers treat missing/tampered/expired identically.
 */
export async function readUserIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(AUTH_USER_COOKIE_NAME)?.value;
  if (!value) return null;
  const payload = verifyToken(value);
  if (!payload) return null;
  const decoded = decode(payload);
  if (!decoded) return null;
  if (decoded.expiresAt <= Date.now()) return null;
  return decoded.userId;
}
