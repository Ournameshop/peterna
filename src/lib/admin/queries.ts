import 'server-only';

import { and, asc, count, desc, eq, gte, sql } from 'drizzle-orm';

import type {
  AdminCostSummary,
  AdminCostWindow,
  AdminRenderRow,
  AdminSessionCostRow,
  AdminUserCostRow,
} from '@/lib/builder/wire-types';
import type { StageTag } from '@/lib/builder/state';
import { getDb } from '@/lib/db/client';
import { renders, sessions, users } from '@/lib/db/schema';

/**
 * Phase 14 — admin observability queries.
 *
 * Pure Drizzle + SQL helpers. No auth checks here — every caller is a route
 * handler that runs `requireAdmin` first. Keeping the gate out of this module
 * makes the helpers reusable (e.g. a future CLI / cron summary) and
 * trivially unit-testable.
 *
 * SQL shape decisions:
 *   - by_capability / by_day aggregates are computed in Postgres, not Node —
 *     a busy admin run shouldn't pull every render row into memory.
 *   - All numeric coercions happen at the JS boundary (Drizzle returns
 *     `numeric(10,4)` as a string from postgres-js by default).
 *   - LEFT JOINs are used to keep anonymous sessions / users-with-no-tributes
 *     visible in the list views.
 */

// -----------------------------------------------------------------------------
// Window resolution
// -----------------------------------------------------------------------------

/**
 * Map a window selector to a SQL lower-bound timestamp. Returns null for the
 * `all` window — callers omit the WHERE clause in that case.
 */
function windowStart(window: AdminCostWindow): Date | null {
  const now = Date.now();
  switch (window) {
    case 'today': {
      const d = new Date(now);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    case '7d':
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case 'all':
      return null;
  }
}

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isoOrNull(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

// -----------------------------------------------------------------------------
// Cost summary
// -----------------------------------------------------------------------------

export async function getCostSummary(window: AdminCostWindow): Promise<AdminCostSummary> {
  const db = getDb();
  const since = windowStart(window);
  const whereExpr = since ? gte(renders.createdAt, since) : undefined;

  // Headline numbers + fallback counter.
  // `fallback_count` = rows where `vendor_served` is set and differs from the
  // first attempted vendor. Done in SQL so we don't materialize every row.
  const totalsRows = await db
    .select({
      total_usd: sql<string>`coalesce(sum(${renders.costUsdEst}), 0)`,
      call_count: sql<number>`count(*)::int`,
      failure_count: sql<number>`count(*) filter (where ${renders.error} is not null)::int`,
      fallback_count: sql<number>`count(*) filter (where ${renders.vendorServed} is not null and ${renders.vendorServed} <> ${renders.vendorAttempted}[1])::int`,
    })
    .from(renders)
    .where(whereExpr);
  const totals = totalsRows[0] ?? {
    total_usd: '0',
    call_count: 0,
    failure_count: 0,
    fallback_count: 0,
  };

  const callCount = num(totals.call_count);
  const failureCount = num(totals.failure_count);
  const fallbackCount = num(totals.fallback_count);

  const byCapabilityRows = await db
    .select({
      capability: renders.capability,
      calls: sql<number>`count(*)::int`,
      total_usd: sql<string>`coalesce(sum(${renders.costUsdEst}), 0)`,
      avg_duration_ms: sql<number>`coalesce(round(avg(${renders.durationMs}))::int, 0)`,
    })
    .from(renders)
    .where(whereExpr)
    .groupBy(renders.capability)
    .orderBy(desc(sql`coalesce(sum(${renders.costUsdEst}), 0)`));

  const byDayRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${renders.createdAt}), 'YYYY-MM-DD')`,
      total_usd: sql<string>`coalesce(sum(${renders.costUsdEst}), 0)`,
      call_count: sql<number>`count(*)::int`,
    })
    .from(renders)
    .where(whereExpr)
    .groupBy(sql`date_trunc('day', ${renders.createdAt})`)
    .orderBy(asc(sql`date_trunc('day', ${renders.createdAt})`));

  return {
    window,
    total_usd: Math.round(num(totals.total_usd) * 10000) / 10000,
    call_count: callCount,
    failure_count: failureCount,
    failure_rate: callCount > 0 ? failureCount / callCount : 0,
    fallback_count: fallbackCount,
    fallback_rate: callCount > 0 ? fallbackCount / callCount : 0,
    by_capability: byCapabilityRows.map((r) => ({
      capability: r.capability,
      calls: num(r.calls),
      total_usd: Math.round(num(r.total_usd) * 10000) / 10000,
      avg_duration_ms: num(r.avg_duration_ms),
    })),
    by_day: byDayRows.map((r) => ({
      day: r.day,
      total_usd: Math.round(num(r.total_usd) * 10000) / 10000,
      call_count: num(r.call_count),
    })),
  };
}

// -----------------------------------------------------------------------------
// Sessions list + detail
// -----------------------------------------------------------------------------

export type ListSessionCostsOptions = {
  limit: number;
  offset: number;
  sort?: 'cost' | 'recent';
};

/**
 * Paginated per-session cost roll-up. LEFT JOINs users (anonymous sessions are
 * common and must remain visible) and the renders aggregate (sessions with no
 * vendor calls yet show $0 / 0 calls).
 */
export async function listSessionCosts(
  opts: ListSessionCostsOptions,
): Promise<{ rows: AdminSessionCostRow[]; total: number }> {
  const db = getDb();
  const limit = Math.max(1, Math.min(opts.limit, 200));
  const offset = Math.max(0, opts.offset);
  const sort = opts.sort ?? 'recent';

  const aggSubquery = db.$with('r_agg').as(
    db
      .select({
        session_id: renders.sessionId,
        total_usd: sql<string>`coalesce(sum(${renders.costUsdEst}), 0)`.as('total_usd'),
        call_count: sql<number>`count(*)::int`.as('call_count'),
        failure_count: sql<number>`count(*) filter (where ${renders.error} is not null)::int`.as(
          'failure_count',
        ),
      })
      .from(renders)
      .groupBy(renders.sessionId),
  );

  const baseQuery = db
    .with(aggSubquery)
    .select({
      session_id: sessions.id,
      pet_name: sessions.petName,
      user_email: users.email,
      stage: sessions.stage,
      total_usd: aggSubquery.total_usd,
      call_count: aggSubquery.call_count,
      failure_count: aggSubquery.failure_count,
      delivery_ready_at: sessions.deliveryReadyAt,
      created_at: sessions.createdAt,
      updated_at: sessions.updatedAt,
    })
    .from(sessions)
    .leftJoin(users, eq(users.id, sessions.userId))
    .leftJoin(aggSubquery, eq(aggSubquery.session_id, sessions.id));

  const sortedRows = await (sort === 'cost'
    ? baseQuery.orderBy(
        desc(sql`coalesce(${aggSubquery.total_usd}, 0)`),
        desc(sessions.updatedAt),
      )
    : baseQuery.orderBy(desc(sessions.updatedAt))
  )
    .limit(limit)
    .offset(offset);

  const totalRows = await db.select({ n: count() }).from(sessions);
  const total = num(totalRows[0]?.n);

  return {
    rows: sortedRows.map((r) => ({
      session_id: r.session_id,
      pet_name: r.pet_name,
      user_email: r.user_email,
      stage: r.stage as StageTag,
      total_usd: Math.round(num(r.total_usd) * 10000) / 10000,
      call_count: num(r.call_count),
      failure_count: num(r.failure_count),
      is_complete: r.delivery_ready_at != null,
      created_at: isoOrNull(r.created_at) ?? '',
      updated_at: isoOrNull(r.updated_at) ?? '',
    })),
    total,
  };
}

export async function getSessionDetail(
  sessionId: string,
): Promise<{ session: AdminSessionCostRow; renders: AdminRenderRow[] } | null> {
  const db = getDb();

  const sessionRows = await db
    .select({
      session_id: sessions.id,
      pet_name: sessions.petName,
      user_email: users.email,
      stage: sessions.stage,
      delivery_ready_at: sessions.deliveryReadyAt,
      created_at: sessions.createdAt,
      updated_at: sessions.updatedAt,
    })
    .from(sessions)
    .leftJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const s = sessionRows[0];
  if (!s) return null;

  const aggRows = await db
    .select({
      total_usd: sql<string>`coalesce(sum(${renders.costUsdEst}), 0)`,
      call_count: sql<number>`count(*)::int`,
      failure_count: sql<number>`count(*) filter (where ${renders.error} is not null)::int`,
    })
    .from(renders)
    .where(eq(renders.sessionId, sessionId));
  const agg = aggRows[0] ?? { total_usd: '0', call_count: 0, failure_count: 0 };

  const renderRows = await selectAdminRenderRows({
    where: eq(renders.sessionId, sessionId),
    limit: 1000,
    offset: 0,
  });

  return {
    session: {
      session_id: s.session_id,
      pet_name: s.pet_name,
      user_email: s.user_email,
      stage: s.stage as StageTag,
      total_usd: Math.round(num(agg.total_usd) * 10000) / 10000,
      call_count: num(agg.call_count),
      failure_count: num(agg.failure_count),
      is_complete: s.delivery_ready_at != null,
      created_at: isoOrNull(s.created_at) ?? '',
      updated_at: isoOrNull(s.updated_at) ?? '',
    },
    renders: renderRows,
  };
}

// -----------------------------------------------------------------------------
// Users list + detail
// -----------------------------------------------------------------------------

export type ListUserCostsOptions = {
  limit: number;
  offset: number;
  sort?: 'cost' | 'recent';
};

export async function listUserCosts(
  opts: ListUserCostsOptions,
): Promise<{ rows: AdminUserCostRow[]; total: number }> {
  const db = getDb();
  const limit = Math.max(1, Math.min(opts.limit, 200));
  const offset = Math.max(0, opts.offset);
  const sort = opts.sort ?? 'recent';

  // Roll up tributes + renders per user in two CTEs so we can ORDER BY them
  // cheaply at the outer level.
  const sessionAgg = db.$with('s_agg').as(
    db
      .select({
        user_id: sessions.userId,
        tribute_count: sql<number>`count(*)::int`.as('tribute_count'),
        completed_tribute_count: sql<number>`count(*) filter (where ${sessions.deliveryReadyAt} is not null)::int`.as(
          'completed_tribute_count',
        ),
        last_active_at: sql<Date | null>`max(${sessions.updatedAt})`.as('last_active_at'),
      })
      .from(sessions)
      .groupBy(sessions.userId),
  );

  const renderAgg = db.$with('r_agg').as(
    db
      .select({
        user_id: sessions.userId,
        total_usd: sql<string>`coalesce(sum(${renders.costUsdEst}), 0)`.as('total_usd'),
        call_count: sql<number>`count(${renders.id})::int`.as('call_count'),
      })
      .from(renders)
      .innerJoin(sessions, eq(sessions.id, renders.sessionId))
      .groupBy(sessions.userId),
  );

  const baseQuery = db
    .with(sessionAgg, renderAgg)
    .select({
      user_id: users.id,
      email: users.email,
      name: users.name,
      tribute_count: sessionAgg.tribute_count,
      completed_tribute_count: sessionAgg.completed_tribute_count,
      total_usd: renderAgg.total_usd,
      call_count: renderAgg.call_count,
      created_at: users.createdAt,
      last_active_at: sessionAgg.last_active_at,
    })
    .from(users)
    .leftJoin(sessionAgg, eq(sessionAgg.user_id, users.id))
    .leftJoin(renderAgg, eq(renderAgg.user_id, users.id));

  const sortedRows = await (sort === 'cost'
    ? baseQuery.orderBy(desc(sql`coalesce(${renderAgg.total_usd}, 0)`), desc(users.createdAt))
    : baseQuery.orderBy(desc(sql`coalesce(${sessionAgg.last_active_at}, ${users.createdAt})`))
  )
    .limit(limit)
    .offset(offset);

  const totalRows = await db.select({ n: count() }).from(users);
  const total = num(totalRows[0]?.n);

  return {
    rows: sortedRows.map((r) => ({
      user_id: r.user_id,
      email: r.email,
      name: r.name,
      tribute_count: num(r.tribute_count),
      completed_tribute_count: num(r.completed_tribute_count),
      total_usd: Math.round(num(r.total_usd) * 10000) / 10000,
      call_count: num(r.call_count),
      created_at: isoOrNull(r.created_at) ?? '',
      last_active_at: isoOrNull(r.last_active_at),
    })),
    total,
  };
}

export async function getUserDetail(
  userId: string,
): Promise<{ user: AdminUserCostRow; sessions: AdminSessionCostRow[] } | null> {
  const db = getDb();

  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      created_at: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const u = userRows[0];
  if (!u) return null;

  const sessionAggRows = await db
    .select({
      tribute_count: sql<number>`count(*)::int`,
      completed_tribute_count: sql<number>`count(*) filter (where ${sessions.deliveryReadyAt} is not null)::int`,
      last_active_at: sql<Date | null>`max(${sessions.updatedAt})`,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId));
  const sAgg = sessionAggRows[0] ?? {
    tribute_count: 0,
    completed_tribute_count: 0,
    last_active_at: null,
  };

  const renderAggRows = await db
    .select({
      total_usd: sql<string>`coalesce(sum(${renders.costUsdEst}), 0)`,
      call_count: sql<number>`count(${renders.id})::int`,
    })
    .from(renders)
    .innerJoin(sessions, eq(sessions.id, renders.sessionId))
    .where(eq(sessions.userId, userId));
  const rAgg = renderAggRows[0] ?? { total_usd: '0', call_count: 0 };

  // The user's sessions, with per-session cost aggregates.
  const sessionRowsAgg = db.$with('rr_agg').as(
    db
      .select({
        session_id: renders.sessionId,
        total_usd: sql<string>`coalesce(sum(${renders.costUsdEst}), 0)`.as('total_usd'),
        call_count: sql<number>`count(*)::int`.as('call_count'),
        failure_count: sql<number>`count(*) filter (where ${renders.error} is not null)::int`.as(
          'failure_count',
        ),
      })
      .from(renders)
      .groupBy(renders.sessionId),
  );

  const sessionRows = await db
    .with(sessionRowsAgg)
    .select({
      session_id: sessions.id,
      pet_name: sessions.petName,
      stage: sessions.stage,
      total_usd: sessionRowsAgg.total_usd,
      call_count: sessionRowsAgg.call_count,
      failure_count: sessionRowsAgg.failure_count,
      delivery_ready_at: sessions.deliveryReadyAt,
      created_at: sessions.createdAt,
      updated_at: sessions.updatedAt,
    })
    .from(sessions)
    .leftJoin(sessionRowsAgg, eq(sessionRowsAgg.session_id, sessions.id))
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.updatedAt));

  return {
    user: {
      user_id: u.id,
      email: u.email,
      name: u.name,
      tribute_count: num(sAgg.tribute_count),
      completed_tribute_count: num(sAgg.completed_tribute_count),
      total_usd: Math.round(num(rAgg.total_usd) * 10000) / 10000,
      call_count: num(rAgg.call_count),
      created_at: isoOrNull(u.created_at) ?? '',
      last_active_at: isoOrNull(sAgg.last_active_at),
    },
    sessions: sessionRows.map((r) => ({
      session_id: r.session_id,
      pet_name: r.pet_name,
      user_email: u.email,
      stage: r.stage as StageTag,
      total_usd: Math.round(num(r.total_usd) * 10000) / 10000,
      call_count: num(r.call_count),
      failure_count: num(r.failure_count),
      is_complete: r.delivery_ready_at != null,
      created_at: isoOrNull(r.created_at) ?? '',
      updated_at: isoOrNull(r.updated_at) ?? '',
    })),
  };
}

// -----------------------------------------------------------------------------
// Renders audit log
// -----------------------------------------------------------------------------

export type ListRendersOptions = {
  limit: number;
  offset: number;
  sessionId?: string;
  userId?: string;
  capability?: string;
  error_only?: boolean;
};

export async function listRenders(
  opts: ListRendersOptions,
): Promise<{ rows: AdminRenderRow[]; total: number }> {
  const db = getDb();
  const limit = Math.max(1, Math.min(opts.limit, 500));
  const offset = Math.max(0, opts.offset);

  const conds = [];
  if (opts.sessionId) conds.push(eq(renders.sessionId, opts.sessionId));
  if (opts.userId) conds.push(eq(sessions.userId, opts.userId));
  if (opts.capability) conds.push(eq(renders.capability, opts.capability));
  if (opts.error_only) conds.push(sql`${renders.error} is not null`);
  const whereExpr = conds.length > 0 ? and(...conds) : undefined;

  const rows = await selectAdminRenderRows({
    where: whereExpr,
    limit,
    offset,
  });

  const totalRows = await db
    .select({ n: count() })
    .from(renders)
    .leftJoin(sessions, eq(sessions.id, renders.sessionId))
    .where(whereExpr);
  const total = num(totalRows[0]?.n);

  return { rows, total };
}

/**
 * Single source-of-truth SELECT for `AdminRenderRow` shape — joins users +
 * sessions so the row carries email + pet_name without forcing the caller to
 * second-fetch.
 */
async function selectAdminRenderRows(args: {
  where: ReturnType<typeof eq> | ReturnType<typeof and> | undefined;
  limit: number;
  offset: number;
}): Promise<AdminRenderRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: renders.id,
      session_id: renders.sessionId,
      pet_name: sessions.petName,
      user_email: users.email,
      stage: renders.stage,
      capability: renders.capability,
      vendor_attempted: renders.vendorAttempted,
      vendor_served: renders.vendorServed,
      model: renders.model,
      cost_usd_est: renders.costUsdEst,
      duration_ms: renders.durationMs,
      error: renders.error,
      response_url: renders.responseUrl,
      created_at: renders.createdAt,
    })
    .from(renders)
    .leftJoin(sessions, eq(sessions.id, renders.sessionId))
    .leftJoin(users, eq(users.id, sessions.userId))
    .where(args.where)
    .orderBy(desc(renders.createdAt))
    .limit(args.limit)
    .offset(args.offset);

  return rows.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    pet_name: r.pet_name,
    user_email: r.user_email,
    stage: r.stage,
    capability: r.capability,
    vendor_attempted: r.vendor_attempted ?? [],
    vendor_served: r.vendor_served,
    model: r.model,
    cost_usd_est: r.cost_usd_est != null ? num(r.cost_usd_est) : null,
    duration_ms: r.duration_ms,
    error: r.error,
    response_url: r.response_url,
    created_at: isoOrNull(r.created_at) ?? '',
  }));
}
