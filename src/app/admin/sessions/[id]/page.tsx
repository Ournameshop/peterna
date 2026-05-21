import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import AdminShell from "@/components/admin/AdminShell";
import CapabilityBadge, {
  NeutralChip,
} from "@/components/admin/CapabilityBadge";
import JsonViewer from "@/components/admin/JsonViewer";
import StatCard from "@/components/admin/StatCard";
import {
  formatAbsolute,
  formatDuration,
  formatInt,
  formatPercent,
  formatRelative,
  formatUsd,
} from "@/lib/admin/format";
import {
  adminFetch,
  requireAdminOrRedirect,
} from "@/lib/admin/page-guard";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import type {
  AdminRenderRow,
  AdminSessionDetailResponse,
} from "@/lib/builder/wire-types";

export const metadata: Metadata = {
  title: "Session — Admin — Peterna",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminSessionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAdminOrRedirect(`/admin/sessions/${id}`);

  const res = await adminFetch<AdminSessionDetailResponse>(
    `/api/admin/sessions/${encodeURIComponent(id)}`,
  );

  if (!res || !res.ok) {
    if (res && !res.ok && res.error === "not-found") notFound();
    return (
      <AdminShell active="sessions" user={user} title="Session">
        <ErrorPanel />
      </AdminShell>
    );
  }

  const { session, renders } = res;
  const failureRate =
    session.call_count > 0 ? session.failure_count / session.call_count : 0;

  return (
    <AdminShell
      active="sessions"
      user={user}
      title={session.pet_name || "Untitled tribute"}
      subtitle={
        <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
          <span>{session.user_email ?? "anonymous"}</span>
          <span style={{ color: C.line }}>·</span>
          <NeutralChip>{session.stage.replace(/_/g, " ")}</NeutralChip>
          {session.is_complete ? (
            <span style={{ color: "#6E8268", fontSize: 12 }}>complete</span>
          ) : null}
        </span>
      }
      actions={
        <Link
          href="/admin/sessions"
          style={{
            fontFamily: FONT_SANS,
            fontSize: 12,
            color: C.inkSofter,
            textDecoration: "none",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          ← All sessions
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
          label="Total spend"
          value={formatUsd(session.total_usd)}
          hint={`across ${formatInt(session.call_count)} calls`}
          tone="gold"
        />
        <StatCard
          label="Failures"
          value={formatInt(session.failure_count)}
          hint={formatPercent(failureRate) + " of calls"}
          tone={failureRate > 0.1 ? "blush" : "ink"}
        />
        <StatCard
          label="Created"
          value={formatRelative(session.created_at)}
          hint={formatAbsolute(session.created_at)}
          tone="ink"
        />
        <StatCard
          label="Updated"
          value={formatRelative(session.updated_at)}
          hint={formatAbsolute(session.updated_at)}
          tone="ink"
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
        Renders audit log
        <span
          style={{
            marginLeft: 12,
            fontSize: 13,
            color: C.inkSofter,
            fontFamily: FONT_SANS,
            letterSpacing: "0.04em",
          }}
        >
          {renders.length} entries
        </span>
      </h2>

      <SessionRenderList renders={renders} />

      <div
        style={{
          marginTop: 24,
          fontSize: 11,
          color: C.inkSofter,
          fontFamily: FONT_SANS,
          letterSpacing: "0.04em",
        }}
      >
        Session ID: <code style={{ color: C.inkSoft }}>{session.session_id}</code>
      </div>
    </AdminShell>
  );
}

function SessionRenderList({ renders }: { renders: AdminRenderRow[] }) {
  if (renders.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          background: "rgba(255,255,255,0.6)",
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          color: C.inkSofter,
          textAlign: "center",
        }}
      >
        No renders recorded for this session yet.
      </div>
    );
  }
  // Expandable list — one card per render, with the JSON body collapsible.
  return (
    <ol
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {renders.map((r) => (
        <li key={r.id}>
          <RenderCard r={r} />
        </li>
      ))}
    </ol>
  );
}

function RenderCard({ r }: { r: AdminRenderRow }) {
  const isFallback =
    r.vendor_served != null &&
    r.vendor_attempted.length > 0 &&
    r.vendor_attempted[0] !== r.vendor_served;
  return (
    <article
      style={{
        background: "rgba(255,255,255,0.65)",
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: "16px 20px",
        fontFamily: FONT_SANS,
        fontSize: 13,
        color: C.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <NeutralChip>{r.stage.replace(/_/g, " ")}</NeutralChip>
          <CapabilityBadge capability={r.capability} />
          {r.vendor_served ? (
            <NeutralChip>{r.vendor_served}</NeutralChip>
          ) : null}
          {isFallback ? (
            <span
              style={{
                fontSize: 10,
                color: C.goldDeep,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
              title={`First tried ${r.vendor_attempted[0]}`}
            >
              fallback
            </span>
          ) : null}
          {r.model ? (
            <span
              style={{
                fontSize: 12,
                color: C.inkSoft,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            >
              {r.model}
            </span>
          ) : null}
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.inkSofter,
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
          }}
          title={formatAbsolute(r.created_at)}
        >
          {formatRelative(r.created_at)}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          fontSize: 12,
          color: C.inkSoft,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <MetaPair label="Cost" value={r.cost_usd_est != null ? formatUsd(r.cost_usd_est) : "—"} />
        <MetaPair label="Duration" value={formatDuration(r.duration_ms)} />
        {r.vendor_attempted.length > 1 ? (
          <MetaPair
            label="Attempted"
            value={r.vendor_attempted.join(" → ")}
          />
        ) : null}
        {r.response_url ? (
          <MetaPair
            label="Response"
            value={
              <a
                href={r.response_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.goldDeep, textDecoration: "none" }}
              >
                open ↗
              </a>
            }
          />
        ) : null}
      </div>

      {r.error ? (
        <div
          role="status"
          style={{
            marginTop: 12,
            padding: "8px 12px",
            background: "rgba(163,80,64,0.08)",
            border: "1px solid rgba(163,80,64,0.25)",
            borderRadius: 8,
            fontSize: 12,
            color: "#A35040",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
          {r.error}
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <JsonViewer value={(r as AdminRenderRow & { request_body?: unknown }).request_body} />
      </div>
    </article>
  );
}

function MetaPair({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: C.inkSofter,
        }}
      >
        {label}
      </span>
      <span style={{ color: C.ink }}>{value}</span>
    </div>
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
      We couldn&apos;t load that session. It may have been deleted, or the
      backend is still coming up.
    </div>
  );
}
