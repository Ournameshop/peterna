import { okJson } from '@/lib/api/respond';
import { clearUserCookie } from '@/lib/auth/user-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/signout (Phase 10)
 *
 * Clears the `auth_user` cookie. Does NOT touch `peterna_session` — the
 * builder cookie outlives sign-in/sign-out cycles by design. A signed-out
 * user can still resume their anonymous in-progress tribute; signing back
 * in later will re-attach it (see `tryLinkAnonymousSession` in
 * `/api/auth/magic-link/consume`).
 *
 * Idempotent: calling on a request with no cookie is a no-op + 200.
 */
export async function POST(): Promise<Response> {
  await clearUserCookie();
  return okJson({ signed_out: true });
}
