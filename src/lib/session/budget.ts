import 'server-only';

import { eq, sum } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { renders } from '@/lib/db/schema';

/**
 * Per-session budget cap, enforced before vendor calls.
 *
 * Per `risk-register.md` Risk #2 ("Cost runaway from re-roll storms") and
 * `api-routes.md` §"Rate limits":
 *   - Hard cap: $10/session. Sum `renders.cost_usd_est` (a numeric column) and reject
 *     a new render if cumulative spend already hit the cap.
 *
 * This runs as a SELECT before the in-flight slot is acquired so a hit user sees a
 * fast 429 with `session-budget-exceeded` instead of a render-in-flight error.
 */

export const SESSION_BUDGET_USD = 10;

export type BudgetResult =
  | { ok: true; spentUsd: number; remainingUsd: number }
  | { ok: false; spentUsd: number; reason: 'session-budget-exceeded' };

/**
 * Returns the current spend (sum of all `renders.cost_usd_est` for the session) and
 * whether we're under the cap. Caller is expected to short-circuit to 429 on `!ok`.
 *
 * Note: race condition between this check and the next render insert is acceptable —
 * the spec specifies "$10 hard cap, email Xee on overage." A double-tap that pushes
 * us $0.40 over the line gets caught on the next call.
 */
export async function checkSessionBudget(sessionId: string): Promise<BudgetResult> {
  const db = getDb();
  const rows = await db
    .select({ total: sum(renders.costUsdEst) })
    .from(renders)
    .where(eq(renders.sessionId, sessionId));

  // `sum()` returns a string from Postgres numeric — coerce safely.
  const raw = rows[0]?.total ?? '0';
  const spent = Number(raw) || 0;

  if (spent >= SESSION_BUDGET_USD) {
    return { ok: false, spentUsd: spent, reason: 'session-budget-exceeded' };
  }
  return { ok: true, spentUsd: spent, remainingUsd: SESSION_BUDGET_USD - spent };
}
