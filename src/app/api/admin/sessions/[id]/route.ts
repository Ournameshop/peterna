import { errJson, okJson } from '@/lib/api/respond';
import { requireAdmin } from '@/lib/admin/auth';
import { getSessionDetail } from '@/lib/admin/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/sessions/[id] (Phase 14)
 *
 * Drill-down: the session's cost row + every renders entry for it (capped at
 * 1000 inside the query helper — anything bigger is a degenerate session and
 * should not be paged in the same payload).
 */
export async function GET(req: Request, ctx: RouteParams): Promise<Response> {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return errJson(auth.error, { status: auth.error === 'forbidden' ? 403 : 401 });
  }

  const { id } = await ctx.params;
  if (!id) return errJson('not-found', { status: 404 });

  const detail = await getSessionDetail(id);
  if (!detail) return errJson('not-found', { status: 404 });

  return okJson({ session: detail.session, renders: detail.renders });
}
