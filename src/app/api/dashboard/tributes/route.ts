import { desc, eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { readUserIdFromCookie } from '@/lib/auth/user-cookie';
import { buildTributeListItems } from '@/lib/dashboard/tribute-list-item';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/tributes (Phase 11)
 *
 * Returns the signed-in user's tributes, newest-updated first. Anonymous
 * sessions (`user_id IS NULL`) are NEVER included — a user only sees rows
 * they own. The dashboard page itself bounces to /signin on a 401, so this
 * route is the single source of "is this user signed in?" for the list view.
 */
export async function GET(): Promise<Response> {
  const userId = await readUserIdFromCookie();
  if (!userId) return errJson('unauthenticated', { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.updatedAt));

  const tributes = await buildTributeListItems(rows);
  return okJson({ tributes });
}
