import type { Metadata } from "next";

import AdminShell from "@/components/admin/AdminShell";
import Pagination from "@/components/admin/Pagination";
import UsersTable from "@/components/admin/UsersTable";
import {
  adminFetch,
  requireAdminOrRedirect,
} from "@/lib/admin/page-guard";
import { C } from "@/lib/peterna-tokens";
import type { AdminUsersListResponse } from "@/lib/builder/wire-types";

export const metadata: Metadata = {
  title: "Users — Admin — Peterna",
  robots: { index: false, follow: false },
};

const VALID_SORTS: ReadonlySet<string> = new Set([
  "recent",
  "cost",
  "tributes",
]);

type SortKey = "recent" | "cost" | "tributes";

type PageProps = {
  searchParams: Promise<{
    sort?: string;
    limit?: string;
    offset?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const user = await requireAdminOrRedirect("/admin/users");
  const sp = await searchParams;
  const sort: SortKey =
    sp.sort && VALID_SORTS.has(sp.sort) ? (sp.sort as SortKey) : "recent";
  const limit = clampInt(sp.limit, 25, 1, 200);
  const offset = clampInt(sp.offset, 0, 0, 10_000);

  const res = await adminFetch<AdminUsersListResponse>(
    `/api/admin/users?sort=${sort}&limit=${limit}&offset=${offset}`,
  );

  if (!res || !res.ok) {
    return (
      <AdminShell active="users" user={user} title="Users">
        <ErrorPanel />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      active="users"
      user={user}
      title="Users"
      subtitle={`${res.total.toLocaleString()} signed-in user${res.total === 1 ? "" : "s"}`}
    >
      <UsersTable rows={res.users} sort={sort} basePath="/admin/users" />
      <Pagination
        basePath="/admin/users"
        limit={limit}
        offset={offset}
        total={res.total}
        extraParams={{ sort }}
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
      We couldn&apos;t load the users list. The backend may still be coming up.
    </div>
  );
}
