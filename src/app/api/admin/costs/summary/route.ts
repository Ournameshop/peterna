import { errJson, okJson } from '@/lib/api/respond';
import { requireAdmin } from '@/lib/admin/auth';
import { getCostSummary } from '@/lib/admin/queries';
import type { AdminCostWindow } from '@/lib/builder/wire-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ALLOWED_WINDOWS: readonly AdminCostWindow[] = ['today', '7d', '30d', 'all'] as const;

/**
 * GET /api/admin/costs/summary (Phase 14)
 *
 * Query params:
 *   - `window`: one of `today` | `7d` | `30d` | `all` (default `7d`).
 *
 * Returns the headline cost summary used by the admin overview screen:
 *   - total_usd, call_count, failure_count + rate, fallback_count + rate
 *   - by_capability (sum, calls, avg duration)
 *   - by_day (daily buckets via date_trunc('day'))
 *
 * Auth: admin-only. 401 for missing cookie, 403 for non-admin users.
 */
export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return errJson(auth.error, { status: auth.error === 'forbidden' ? 403 : 401 });
  }

  const { searchParams } = new URL(req.url);
  const windowRaw = (searchParams.get('window') ?? '7d') as AdminCostWindow;
  const window = ALLOWED_WINDOWS.includes(windowRaw) ? windowRaw : '7d';

  const summary = await getCostSummary(window);
  return okJson({ summary });
}
