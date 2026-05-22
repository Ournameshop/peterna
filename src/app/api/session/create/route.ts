import { v7 as uuidv7 } from 'uuid';

import { okJson } from '@/lib/api/respond';
import { readUserIdFromCookie } from '@/lib/auth/user-cookie';
// Importing the response type keeps this route's payload typed via the shared
// wire-types contract — `src/lib/builder/wire-types.ts`.
import type { SessionCreateResponse } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { setSessionCookie } from '@/lib/session/cookie';
import { generateToken } from '@/lib/session/hmac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/session/create — creates a session, sets the HMAC-signed cookie,
 * returns the new session id + a shareable resume token. Body is empty.
 *
 * If the request carries a valid `auth_user` cookie, the new session is
 * created with `user_id` already attached — so a signed-in user who starts
 * a new tribute gets an owned session from the very first row, and the
 * dashboard/authBySession recovery path works on every subsequent request.
 * Anonymous callers (no `auth_user` cookie) get the legacy null-user_id
 * behavior.
 *
 * The HMAC cookie payload encodes `<sessionId>:<cookieToken>`; verifying the cookie alone
 * isn't enough — every authenticated route compares the cookie's `cookieToken` against the
 * value persisted on the row, so cookie-rotation works without a re-auth flow.
 *
 * Wire shape: snake_case across all fields — see `src/lib/builder/wire-types.ts`.
 */
export async function POST(): Promise<Response> {
  const db = getDb();

  const id = uuidv7();
  const cookieToken = generateToken();
  const resumeToken = generateToken();

  // If the request is from a signed-in user, attach ownership at creation
  // time — saves a round-trip through /api/dashboard/tributes/claim and
  // ensures the row is never orphaned anonymous.
  const userId = await readUserIdFromCookie();

  await db.insert(sessions).values({
    id,
    cookieToken,
    resumeToken,
    stage: 'intake_welcome',
    ...(userId ? { userId } : {}),
  });

  await setSessionCookie({ sessionId: id, cookieToken });

  const body: Omit<Extract<SessionCreateResponse, { ok: true }>, 'ok'> = {
    session_id: id,
    resume_token: resumeToken,
  };
  return okJson(body as unknown as Record<string, unknown>);
}
