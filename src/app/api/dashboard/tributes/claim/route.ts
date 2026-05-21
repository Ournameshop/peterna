import { and, eq, isNull } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { readUserIdFromCookie } from '@/lib/auth/user-cookie';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { getSessionCookie } from '@/lib/session/cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/dashboard/tributes/claim (Phase 11)
 *
 * Links the caller's anonymous `peterna_session` cookie (if any) to their
 * signed-in user account, but only if that session is still unowned
 * (`user_id IS NULL`). Mirrors `tryLinkAnonymousSession` in
 * /api/auth/magic-link/consume — the same defensive rule applies: never
 * steal a session already attached to another user.
 *
 * Returns `{ claimed: 1 }` when we attached a row, `{ claimed: 0 }` when
 * there was nothing eligible to claim. Both are 200 — the dashboard treats
 * "nothing to claim" as a soft no-op, not an error.
 */
export async function POST(): Promise<Response> {
  const userId = await readUserIdFromCookie();
  if (!userId) return errJson('unauthenticated', { status: 401 });

  const cookie = await getSessionCookie();
  if (!cookie) return okJson({ claimed: 0 });

  const db = getDb();
  const updated = await db
    .update(sessions)
    .set({ userId, updatedAt: new Date() })
    .where(and(eq(sessions.id, cookie.sessionId), isNull(sessions.userId)))
    .returning({ id: sessions.id });

  return okJson({ claimed: updated.length });
}
