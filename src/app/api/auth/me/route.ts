import { eq } from 'drizzle-orm';

import { okJson } from '@/lib/api/respond';
import { readUserIdFromCookie } from '@/lib/auth/user-cookie';
import type { UserWire } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/me (Phase 10)
 *
 * Reads the `auth_user` cookie, looks up the row, returns either
 * `{ ok: true, user: <UserWire> }` or `{ ok: true, user: null }`.
 *
 * Crucially: anonymous browsing is a first-class state, NOT an error. We
 * never return 401 here; the frontend treats `user: null` as "show the
 * sign-in CTA" and continues to render the rest of the app normally.
 *
 * A cookie that decodes but points at a missing user row (race: account
 * deleted in another tab) is treated identically to no cookie — return null,
 * let the caller signout via UI if they want.
 */
export async function GET(): Promise<Response> {
  const userId = await readUserIdFromCookie();
  if (!userId) return okJson({ user: null });

  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) return okJson({ user: null });

  const wire: UserWire = {
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.createdAt.toISOString(),
    email_verified_at: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
  };
  return okJson({ user: wire });
}
