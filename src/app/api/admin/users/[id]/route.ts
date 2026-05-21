import { errJson, okJson } from '@/lib/api/respond';
import { requireAdmin } from '@/lib/admin/auth';
import { getUserDetail } from '@/lib/admin/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/users/[id] (Phase 14)
 *
 * Drill-down: the user's roll-up row + every session they own with per-session
 * cost aggregates. The user email is hydrated onto each session row so the
 * frontend doesn't have to re-fetch.
 */
export async function GET(req: Request, ctx: RouteParams): Promise<Response> {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return errJson(auth.error, { status: auth.error === 'forbidden' ? 403 : 401 });
  }

  const { id } = await ctx.params;
  if (!id) return errJson('not-found', { status: 404 });

  const detail = await getUserDetail(id);
  if (!detail) return errJson('not-found', { status: 404 });

  return okJson({ user: detail.user, sessions: detail.sessions });
}
