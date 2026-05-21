import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import AdminShell from "@/components/admin/AdminShell";
import SessionsTable from "@/components/admin/SessionsTable";
import StatCard from "@/components/admin/StatCard";
import {
  formatAbsolute,
  formatInt,
  formatRelative,
  formatUsd,
} from "@/lib/admin/format";
import {
  adminFetch,
  requireAdminOrRedirect,
} from "@/lib/admin/page-guard";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import type { AdminUserDetailResponse } from "@/lib/builder/wire-types";

export const metadata: Metadata = {
  title: "User — Admin — Peterna",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const me = await requireAdminOrRedirect(`/admin/users/${id}`);

  const res = await adminFetch<AdminUserDetailResponse>(
    `/api/admin/users/${encodeURIComponent(id)}`,
  );

  if (!res || !res.ok) {
    if (res && !res.ok && res.error === "not-found") notFound();
    return (
      <AdminShell active="users" user={me} title="User">
        <ErrorPanel />
      </AdminShell>
    );
  }

  const { user, sessions } = res;

  return (
    <AdminShell
      active="users"
      user={me}
      title={user.name || user.email}
      subtitle={
        <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
          <span>{user.email}</span>
          <span style={{ color: C.line }}>·</span>
          <span style={{ fontSize: 13 }}>
            joined {formatRelative(user.created_at)}
          </span>
        </span>
      }
      actions={
        <Link
          href="/admin/users"
          style={{
            fontFamily: FONT_SANS,
            fontSize: 12,
            color: C.inkSofter,
            textDecoration: "none",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          ← All users
        </Link>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <StatCard
          label="Tributes"
          value={formatInt(user.tribute_count)}
          hint={`${formatInt(user.completed_tribute_count)} complete`}
          tone="ink"
        />
        <StatCard
          label="Total spend"
          value={formatUsd(user.total_usd)}
          hint={`across ${formatInt(user.call_count)} calls`}
          tone="gold"
        />
        <StatCard
          label="Joined"
          value={formatRelative(user.created_at)}
          hint={formatAbsolute(user.created_at)}
          tone="ink"
        />
        <StatCard
          label="Last active"
          value={
            user.last_active_at ? formatRelative(user.last_active_at) : "never"
          }
          hint={
            user.last_active_at ? formatAbsolute(user.last_active_at) : undefined
          }
          tone="sage"
        />
      </div>

      <h2
        style={{
          margin: "0 0 12px",
          fontFamily: FONT_DISPLAY,
          fontWeight: 400,
          fontSize: 24,
          color: C.ink,
        }}
      >
        Tributes
        <span
          style={{
            marginLeft: 12,
            fontSize: 13,
            color: C.inkSofter,
            fontFamily: FONT_SANS,
            letterSpacing: "0.04em",
          }}
        >
          {sessions.length}
        </span>
      </h2>

      <SessionsTable rows={sessions} basePath="/admin/sessions" />

      <div
        style={{
          marginTop: 24,
          fontSize: 11,
          color: C.inkSofter,
          fontFamily: FONT_SANS,
          letterSpacing: "0.04em",
        }}
      >
        User ID: <code style={{ color: C.inkSoft }}>{user.user_id}</code>
      </div>
    </AdminShell>
  );
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
      We couldn&apos;t load that user. They may have been deleted, or the
      backend is still coming up.
    </div>
  );
}
