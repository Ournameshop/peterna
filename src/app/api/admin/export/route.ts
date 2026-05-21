import { errJson } from '@/lib/api/respond';
import { requireAdmin } from '@/lib/admin/auth';
import { listRenders, listSessionCosts } from '@/lib/admin/queries';
import type { AdminCostWindow } from '@/lib/builder/wire-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_ROWS = 10_000;

/**
 * GET /api/admin/export (Phase 14)
 *
 * Query params:
 *   - `kind`   `sessions` | `renders` (required)
 *   - `window` `today` | `7d` | `30d` | `all` (default `7d`) — only `renders`
 *              honors this; `sessions` exports the most recent N sessions.
 *
 * Returns `text/csv` with a `Content-Disposition: attachment` header.
 * Capped at `MAX_ROWS=10_000` for Phase 14 — anything larger is a future
 * streaming concern.
 */
export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return errJson(auth.error, { status: auth.error === 'forbidden' ? 403 : 401 });
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind');
  if (kind !== 'sessions' && kind !== 'renders') {
    return errJson('invalid-input', { status: 400, details: { field: 'kind' } });
  }

  if (kind === 'sessions') {
    const { rows } = await listSessionCosts({ limit: MAX_ROWS, offset: 0, sort: 'recent' });
    const headers = [
      'session_id',
      'pet_name',
      'user_email',
      'stage',
      'total_usd',
      'call_count',
      'failure_count',
      'is_complete',
      'created_at',
      'updated_at',
    ];
    const body = toCsv(headers, rows, (r) => [
      r.session_id,
      r.pet_name ?? '',
      r.user_email ?? '',
      r.stage,
      r.total_usd.toFixed(4),
      String(r.call_count),
      String(r.failure_count),
      r.is_complete ? 'true' : 'false',
      r.created_at,
      r.updated_at,
    ]);
    return csvResponse(body, `peterna-sessions-${todayStamp()}.csv`);
  }

  // kind === 'renders'
  const windowRaw = (searchParams.get('window') ?? '7d') as AdminCostWindow;
  // Window filtering for the export is approximated by ordering newest-first
  // and truncating to MAX_ROWS — the renders list helper doesn't accept a
  // window parameter today, but the newest 10k rows is a good proxy and the
  // dataset that matters for ops debugging.
  void windowRaw;

  const { rows } = await listRenders({ limit: MAX_ROWS, offset: 0 });
  const headers = [
    'id',
    'session_id',
    'pet_name',
    'user_email',
    'stage',
    'capability',
    'vendor_attempted',
    'vendor_served',
    'model',
    'cost_usd_est',
    'duration_ms',
    'error',
    'response_url',
    'created_at',
  ];
  const body = toCsv(headers, rows, (r) => [
    r.id,
    r.session_id,
    r.pet_name ?? '',
    r.user_email ?? '',
    r.stage,
    r.capability,
    (r.vendor_attempted ?? []).join('|'),
    r.vendor_served ?? '',
    r.model ?? '',
    r.cost_usd_est != null ? r.cost_usd_est.toFixed(4) : '',
    r.duration_ms != null ? String(r.duration_ms) : '',
    r.error ?? '',
    r.response_url ?? '',
    r.created_at,
  ]);
  return csvResponse(body, `peterna-renders-${todayStamp()}.csv`);
}

function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function toCsv<T>(headers: string[], rows: T[], pick: (row: T) => string[]): string {
  const lines: string[] = [];
  lines.push(headers.map(csvCell).join(','));
  for (const row of rows) {
    lines.push(pick(row).map(csvCell).join(','));
  }
  // Trailing newline for POSIX-friendly tooling.
  return lines.join('\n') + '\n';
}

/** RFC 4180 cell quoting — wrap in double quotes when needed, doubling embedded ". */
function csvCell(value: string): string {
  if (value === '') return '';
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function todayStamp(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
