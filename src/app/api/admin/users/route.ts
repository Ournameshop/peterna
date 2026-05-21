import { errJson, okJson } from '@/lib/api/respond';
import { requireAdmin } from '@/lib/admin/auth';
import { listUserCosts } from '@/lib/admin/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/admin/users (Phase 14)
 *
 * Query params:
 *   - `limit`  (default 20, capped at 200)
 *   - `offset` (default 0)
 *   - `sort`   `cost` | `recent` (default `recent` — most recent session)
 *
 * Returns paginated per-user roll-ups. Anonymous sessions don't surface here
 * — they live on /api/admin/sessions instead.
 */
export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return errJson(auth.error, { status: auth.error === 'forbidden' ? 403 : 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseIntDefault(searchParams.get('limit'), 20);
  const offset = parseIntDefault(searchParams.get('offset'), 0);
  const sortRaw = searchParams.get('sort');
  const sort: 'cost' | 'recent' = sortRaw === 'cost' ? 'cost' : 'recent';

  const { rows, total } = await listUserCosts({ limit, offset, sort });
  return okJson({ users: rows, total, limit, offset });
}

function parseIntDefault(v: string | null, fallback: number): number {
  if (v == null) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
