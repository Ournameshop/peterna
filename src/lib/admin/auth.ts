import 'server-only';

import { eq } from 'drizzle-orm';

import { readUserIdFromCookie } from '@/lib/auth/user-cookie';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

/**
 * Phase 14 — admin auth gate.
 *
 * Admin access is gated by membership in the `ADMIN_EMAILS` env var
 * (comma-separated). We deliberately don't introduce an `is_admin` column on
 * the users table — admin status is a deployment concern, not a per-row data
 * concern. Promoting / demoting an admin is a config change, not a write.
 *
 * The auth chain is the same as the dashboard: read the signed `auth_user`
 * cookie, look up the user's email, then check the allowlist. Anonymous and
 * non-admin users get distinct error codes so the route layer can pick the
 * right HTTP status (401 vs 403).
 */

/**
 * Parse + memoize the allowlist once per process. Re-reading `process.env` on
 * every request is fine cost-wise, but the lowercase/trim work isn't free and
 * the value doesn't change without a redeploy.
 *
 * Stored as a Set for O(1) lookup. Empty Set when the env var is unset, which
 * effectively closes the gate — exactly the behavior we want in misconfigured
 * environments.
 */
let cachedAllowlist: Set<string> | null = null;
let cachedAllowlistFor: string | undefined;

function getAllowlist(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  if (cachedAllowlist && cachedAllowlistFor === raw) return cachedAllowlist;
  const set = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0),
  );
  cachedAllowlist = set;
  cachedAllowlistFor = raw;
  return set;
}

/**
 * Check whether `email` is on the configured allowlist. Comparison is
 * case-insensitive + trimmed on both sides.
 */
export function isAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return getAllowlist().has(normalized);
}

export type AdminAuthOk = { ok: true; userId: string; email: string };
export type AdminAuthErr = { ok: false; error: 'unauthenticated' | 'forbidden' };
export type AdminAuthResult = AdminAuthOk | AdminAuthErr;

/**
 * Resolve the calling user from the `auth_user` cookie, look up their email,
 * and confirm they're on the admin allowlist. Callers in route handlers map
 * the result to 401 (`unauthenticated`) or 403 (`forbidden`).
 *
 * The `req` parameter is unused today (we read cookies via `next/headers`)
 * but is part of the signature so we can later support bearer-token-style
 * service auth without churning every call site.
 */
export async function requireAdmin(_req: Request): Promise<AdminAuthResult> {
  const userId = await readUserIdFromCookie();
  if (!userId) return { ok: false, error: 'unauthenticated' };

  const db = getDb();
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) return { ok: false, error: 'unauthenticated' };

  if (!isAdminEmail(user.email)) return { ok: false, error: 'forbidden' };

  return { ok: true, userId: user.id, email: user.email };
}
