import type { Metadata } from "next";

import AdminShell from "@/components/admin/AdminShell";
import Pagination from "@/components/admin/Pagination";
import SessionsTable from "@/components/admin/SessionsTable";
import WindowToggle from "@/components/admin/WindowToggle";
import {
  adminFetch,
  requireAdminOrRedirect,
} from "@/lib/admin/page-guard";
import { C } from "@/lib/peterna-tokens";
import type {
  AdminCostWindow,
  AdminSessionsListResponse,
} from "@/lib/builder/wire-types";

export const metadata: Metadata = {
  title: "Sessions — Admin — Peterna",
  robots: { index: false, follow: false },
};

const VALID_WINDOWS: ReadonlySet<AdminCostWindow> = new Set([
  "today",
  "7d",
  "30d",
  "all",
]);
const VALID_SORTS: ReadonlySet<string> = new Set(["recent", "cost", "calls"]);

type SortKey = "recent" | "cost" | "calls";

type PageProps = {
  searchParams: Promise<{
    window?: string;
    sort?: string;
    limit?: string;
    offset?: string;
  }>;
};

export default async function AdminSessionsPage({ searchParams }: PageProps) {
  const user = await requireAdminOrRedirect("/admin/sessions");
  const sp = await searchParams;
  const win: AdminCostWindow =
    sp.window && (VALID_WINDOWS as Set<string>).has(sp.window)
      ? (sp.window as AdminCostWindow)
      : "7d";
  const sort: SortKey =
    sp.sort && VALID_SORTS.has(sp.sort) ? (sp.sort as SortKey) : "recent";
  const limit = clampInt(sp.limit, 25, 1, 200);
  const offset = clampInt(sp.offset, 0, 0, 10_000);

  const res = await adminFetch<AdminSessionsListResponse>(
    `/api/admin/sessions?window=${win}&sort=${sort}&limit=${limit}&offset=${offset}`,
  );

  if (!res || !res.ok) {
    return (
      <AdminShell
        active="sessions"
        user={user}
        title="Sessions"
        actions={<WindowToggle active={win} basePath="/admin/sessions" extraParams={{ sort }} />}
      >
        <ErrorPanel />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      active="sessions"
      user={user}
      title="Sessions"
      subtitle={`${res.total.toLocaleString()} session${res.total === 1 ? "" : "s"} in this window`}
      actions={
        <WindowToggle
          active={win}
          basePath="/admin/sessions"
          extraParams={{ sort }}
        />
      }
    >
      <SessionsTable
        rows={res.sessions}
        sort={sort}
        basePath="/admin/sessions"
        extraParams={{ window: win }}
      />
      <Pagination
        basePath="/admin/sessions"
        limit={limit}
        offset={offset}
        total={res.total}
        extraParams={{ window: win, sort }}
      />
    </AdminShell>
  );
}

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function ErrorPanel() {
  return (
    <div
      role="alert"
      style={{
        padding: "24px 28px",
        borderRadius: 12,
        border: `1px solid ${C.line}`,
        background: "rgba(248,241,228,0.6)",
        color: C.inkSoft,
        fontSize: 14,
      }}
    >
      We couldn&apos;t load the sessions list. The backend may still be coming
      up — try again in a moment.
    </div>
  );
}
