import { errJson, okJson } from '@/lib/api/respond';
import { requireAdmin } from '@/lib/admin/auth';
import { listRenders } from '@/lib/admin/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/admin/renders (Phase 14)
 *
 * Paginated audit log over the `renders` table. Filters:
 *   - `session_id`     restrict to one session
 *   - `user_id`        restrict to all sessions owned by one user
 *   - `capability`     restrict to a single capability tag
 *   - `error_only=1`   restrict to failed rows (error is not null)
 *
 * Pagination:
 *   - `limit`  (default 50, capped at 500)
 *   - `offset` (default 0)
 *
 * Each row carries the pet name + user email joined off `sessions` + `users`
 * so the audit-log table can render the headline columns without re-fetching.
 */
export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return errJson(auth.error, { status: auth.error === 'forbidden' ? 403 : 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseIntDefault(searchParams.get('limit'), 50);
  const offset = parseIntDefault(searchParams.get('offset'), 0);
  const sessionId = searchParams.get('session_id') || undefined;
  const userId = searchParams.get('user_id') || undefined;
  const capability = searchParams.get('capability') || undefined;
  const errorOnly = searchParams.get('error_only') === '1';

  const { rows, total } = await listRenders({
    limit,
    offset,
    sessionId,
    userId,
    capability,
    error_only: errorOnly,
  });

  return okJson({ renders: rows, total, limit, offset });
}

function parseIntDefault(v: string | null, fallback: number): number {
  if (v == null) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
