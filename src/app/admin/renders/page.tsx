import type { Metadata } from "next";

import AdminShell from "@/components/admin/AdminShell";
import Pagination from "@/components/admin/Pagination";
import RendersFilters from "@/components/admin/RendersFilters";
import RendersTable from "@/components/admin/RendersTable";
import WindowToggle from "@/components/admin/WindowToggle";
import {
  adminFetch,
  requireAdminOrRedirect,
} from "@/lib/admin/page-guard";
import { C, FONT_SANS } from "@/lib/peterna-tokens";
import type {
  AdminCostWindow,
  AdminRendersListResponse,
} from "@/lib/builder/wire-types";

export const metadata: Metadata = {
  title: "Renders — Admin — Peterna",
  robots: { index: false, follow: false },
};

const VALID_WINDOWS: ReadonlySet<AdminCostWindow> = new Set([
  "today",
  "7d",
  "30d",
  "all",
]);

type PageProps = {
  searchParams: Promise<{
    window?: string;
    capability?: string;
    vendor?: string;
    errors_only?: string;
    from?: string;
    to?: string;
    limit?: string;
    offset?: string;
  }>;
};

export default async function AdminRendersPage({ searchParams }: PageProps) {
  const user = await requireAdminOrRedirect("/admin/renders");
  const sp = await searchParams;
  const win: AdminCostWindow =
    sp.window && (VALID_WINDOWS as Set<string>).has(sp.window)
      ? (sp.window as AdminCostWindow)
      : "7d";
  const capability = sp.capability ?? "";
  const vendor = sp.vendor ?? "";
  const errorsOnly = sp.errors_only === "1" || sp.errors_only === "true";
  const from = sp.from ?? "";
  const to = sp.to ?? "";
  const limit = clampInt(sp.limit, 50, 1, 500);
  const offset = clampInt(sp.offset, 0, 0, 100_000);

  // Build the API query. Empty filters are omitted so the backend doesn't
  // have to special-case "" vs missing.
  const apiParams = new URLSearchParams();
  apiParams.set("window", win);
  apiParams.set("limit", String(limit));
  apiParams.set("offset", String(offset));
  if (capability) apiParams.set("capability", capability);
  if (vendor) apiParams.set("vendor", vendor);
  if (errorsOnly) apiParams.set("errors_only", "1");
  if (from) apiParams.set("from", from);
  if (to) apiParams.set("to", to);

  const res = await adminFetch<AdminRendersListResponse>(
    `/api/admin/renders?${apiParams.toString()}`,
  );

  // CSV export — same filters, different route.
  const exportParams = new URLSearchParams(apiParams);
  exportParams.set("kind", "renders");
  const csvHref = `/api/admin/export?${exportParams.toString()}`;

  // The Pagination + WindowToggle need to preserve every active filter so
  // the user doesn't lose state when paging.
  const extraParams = {
    window: win,
    capability: capability || undefined,
    vendor: vendor || undefined,
    errors_only: errorsOnly ? "1" : undefined,
    from: from || undefined,
    to: to || undefined,
  };

  if (!res || !res.ok) {
    return (
      <AdminShell
        active="renders"
        user={user}
        title="Renders"
        actions={
          <WindowToggle
            active={win}
            basePath="/admin/renders"
            extraParams={extraParams}
          />
        }
      >
        <RendersFilters
          capability={capability}
          vendor={vendor}
          errorsOnly={errorsOnly}
          from={from}
          to={to}
        />
        <ErrorPanel />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      active="renders"
      user={user}
      title="Renders audit log"
      subtitle={`${res.total.toLocaleString()} call${res.total === 1 ? "" : "s"} matching filters`}
      actions={
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <WindowToggle
            active={win}
            basePath="/admin/renders"
            extraParams={extraParams}
          />
          <a
            href={csvHref}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${C.line}`,
              background: "rgba(255,255,255,0.6)",
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.ink,
              textDecoration: "none",
              fontFamily: FONT_SANS,
            }}
          >
            Export CSV ↓
          </a>
        </div>
      }
    >
      <RendersFilters
        capability={capability}
        vendor={vendor}
        errorsOnly={errorsOnly}
        from={from}
        to={to}
      />
      <RendersTable rows={res.renders} />
      <Pagination
        basePath="/admin/renders"
        limit={limit}
        offset={offset}
        total={res.total}
        extraParams={extraParams}
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
      We couldn&apos;t load the audit log. The backend may still be coming up.
    </div>
  );
}
