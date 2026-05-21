import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { readUserIdFromCookie } from '@/lib/auth/user-cookie';
import { errJson, okJson } from '@/lib/api/respond';
import { getDb } from '@/lib/db/client';
import { pushSubscriptions } from '@/lib/db/schema';
import { getSessionCookie } from '@/lib/session/cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/push/subscribe
 *
 * Body: standard `PushSubscriptionJSON` shape:
 *   { endpoint, keys: { p256dh, auth }, session_id? }
 *
 * Saves a row keyed to either:
 *   - the signed-in user (when an auth_user cookie is present), OR
 *   - the session_id passed by an anonymous builder
 *
 * If the same `endpoint` already exists, we update it in place (the user
 * might have signed in mid-build; we re-bind the existing row to the new
 * owner). Endpoint is the natural key per the Web Push spec.
 */
export async function POST(req: Request): Promise<Response> {
  let body: {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
    session_id?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return errJson('invalid-input', { status: 400 });
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : '';
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : '';
  if (!endpoint || !p256dh || !auth) {
    return errJson('invalid-input', {
      status: 400,
      details: { fields: ['endpoint', 'keys.p256dh', 'keys.auth'] },
    });
  }

  const userId = await readUserIdFromCookie();
  const sessionCookie = await getSessionCookie();
  const bodySessionId = typeof body.session_id === 'string' ? body.session_id : null;
  const sessionId = sessionCookie?.sessionId ?? bodySessionId ?? null;

  // Reject the empty case so we don't end up with orphan rows nobody can
  // address. At least one owner key is required.
  if (!userId && !sessionId) {
    return errJson('invalid-input', { status: 400, details: { reason: 'no-owner' } });
  }

  const db = getDb();

  // Upsert by endpoint. We avoid `ON CONFLICT` here because we may also
  // need to flip `userId`/`sessionId` on the existing row when ownership
  // changes (anonymous → signed-in).
  const existing = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .limit(1);

  if (existing[0]) {
    await db
      .update(pushSubscriptions)
      .set({
        userId: userId ?? null,
        sessionId: sessionId ?? null,
        p256dh,
        auth,
      })
      .where(eq(pushSubscriptions.id, existing[0].id));
  } else {
    await db.insert(pushSubscriptions).values({
      id: uuidv7(),
      userId: userId ?? null,
      sessionId: sessionId ?? null,
      endpoint,
      p256dh,
      auth,
    });
  }

  return okJson({ subscribed: true });
}
