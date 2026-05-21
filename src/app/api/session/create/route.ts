import { v7 as uuidv7 } from 'uuid';

import { okJson } from '@/lib/api/respond';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { setSessionCookie } from '@/lib/session/cookie';
import { generateToken } from '@/lib/session/hmac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/session/create — creates an anonymous session, sets the HMAC-signed cookie,
 * returns the new session id + a shareable resume token. Body is empty.
 *
 * The HMAC cookie payload encodes `<sessionId>:<cookieToken>`; verifying the cookie alone
 * isn't enough — every authenticated route compares the cookie's `cookieToken` against the
 * value persisted on the row, so cookie-rotation works without a re-auth flow.
 */
export async function POST(): Promise<Response> {
  const db = getDb();

  const id = uuidv7();
  const cookieToken = generateToken();
  const resumeToken = generateToken();

  await db.insert(sessions).values({
    id,
    cookieToken,
    resumeToken,
    stage: 'intake_welcome',
  });

  await setSessionCookie({ sessionId: id, cookieToken });

  return okJson({ sessionId: id, resumeToken });
}
