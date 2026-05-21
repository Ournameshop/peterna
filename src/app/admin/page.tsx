import Link from "next/link";
import type { Metadata } from "next";

import AdminShell from "@/components/admin/AdminShell";
import BarRow from "@/components/admin/BarRow";
import CapabilityBadge from "@/components/admin/CapabilityBadge";
import Sparkline from "@/components/admin/Sparkline";
import StatCard from "@/components/admin/StatCard";
import WindowToggle from "@/components/admin/WindowToggle";
import {
  formatDuration,
  formatInt,
  formatPercent,
  formatUsd,
  formatUsdCompact,
} from "@/lib/admin/format";
import {
  adminFetch,
  requireAdminOrRedirect,
} from "@/lib/admin/page-guard";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import type {
  AdminCostSummary,
  AdminCostSummaryResponse,
  AdminCostWindow,
  AdminRenderRow,
  AdminRendersListResponse,
  AdminSessionCostRow,
  AdminSessionsListResponse,
} from "@/lib/builder/wire-types";

import RendersTable from "@/components/admin/RendersTable";
import SessionsTable from "@/components/admin/SessionsTable";

// Phase 14 — admin overview.
//
// Server component. Fetches:
//   1. /api/admin/costs/summary?window=… — headline cards + by-capability +
//      by-day arrays.
//   2. /api/admin/sessions?sort=cost&limit=5 — top spenders.
//   3. /api/admin/renders?errors_only=1&limit=5 — recent failures.
//
// All three are fetched concurrently with Promise.all so the page render
// blocks for the slowest, not the sum.

export const metadata: Metadata = {
  title: "Admin — Peterna",
  robots: { index: false, follow: false },
};

const VALID_WINDOWS: ReadonlySet<AdminCostWindow> = new Set([
  "today",
  "7d",
  "30d",
  "all",
]);

function parseWindow(raw: string | undefined): AdminCostWindow {
  if (raw && (VALID_WINDOWS as Set<string>).has(raw))
    return raw as AdminCostWindow;
  return "7d";
}

type PageProps = {
  searchParams: Promise<{ window?: string }>;
};

export default async function AdminOverviewPage({ searchParams }: PageProps) {
  const user = await requireAdminOrRedirect("/admin");
  const sp = await searchParams;
  const win = parseWindow(sp.window);

  const [summaryRes, topSessionsRes, failuresRes] = await Promise.all([
    adminFetch<AdminCostSummaryResponse>(
      `/api/admin/costs/summary?window=${win}`,
    ),
    adminFetch<AdminSessionsListResponse>(
      `/api/admin/sessions?sort=cost&limit=5&window=${win}`,
    ),
    adminFetch<AdminRendersListResponse>(
      `/api/admin/renders?errors_only=1&limit=5&window=${win}`,
    ),
  ]);

  const summary: AdminCostSummary | null =
    summaryRes && summaryRes.ok ? summaryRes.summary : null;
  const topSessions: AdminSessionCostRow[] =
    topSessionsRes && topSessionsRes.ok ? topSessionsRes.sessions : [];
  const recentFailures: AdminRenderRow[] =
    failuresRes && failuresRes.ok ? failuresRes.renders : [];

  return (
    <AdminShell
      active="overview"
      user={user}
      title="Overview"
      subtitle="Spend, generation, and vendor health at a glance."
      actions={<WindowToggle active={win} basePath="/admin" />}
    >
      {summary == null ? (
        <ErrorPanel message="Couldn't load the cost summary. The backend may still be coming up — try again in a moment." />
      ) : (
        <>
          <StatGrid summary={summary} />
          <DaySparkSection summary={summary} />
          <ByCapabilitySection summary={summary} />
          <TwoUp>
            <Card title="Top 5 most expensive sessions">
              <SessionsTable
                rows={topSessions}
                sort="cost"
                basePath="/admin/sessions"
                extraParams={{ window: win }}
              />
              <ViewAllLink
                href={`/admin/sessions?sort=cost&window=${win}`}
                label="View all sessions"
              />
            </Card>
            <Card title="Recent failures">
              <RendersTable rows={recentFailures} />
              <ViewAllLink
                href={`/admin/renders?errors_only=1&window=${win}`}
                label="View all failures"
              />
            </Card>
          </TwoUp>
        </>
      )}
    </AdminShell>
  );
}

function StatGrid({ summary }: { summary: AdminCostSummary }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
      }}
    >
      <StatCard
        label="Total spend"
        value={formatUsdCompact(summary.total_usd)}
        hint={`across ${formatInt(summary.call_count)} calls`}
        tone="gold"
      />
      <StatCard
        label="Calls"
        value={formatInt(summary.call_count)}
        hint={`${summary.by_capability.length} capabilities`}
        tone="ink"
      />
      <StatCard
        label="Failure rate"
        value={formatPercent(summary.failure_rate)}
        hint={`${formatInt(summary.failure_count)} failed`}
        tone={summary.failure_rate > 0.05 ? "blush" : "sage"}
      />
      <StatCard
        label="Fallback rate"
        value={formatPercent(summary.fallback_rate)}
        hint={`${formatInt(summary.fallback_count)} fell back`}
        tone="sage"
      />
    </div>
  );
}

function DaySparkSection({ summary }: { summary: AdminCostSummary }) {
  if (!summary.by_day || summary.by_day.length === 0) return null;
  const data = summary.by_day.map((d) => d.total_usd);
  const maxDay = summary.by_day.reduce(
    (acc, d) => (d.total_usd > acc.total_usd ? d : acc),
    summary.by_day[0],
  );
  return (
    <section style={{ marginTop: 32 }}>
      <div
        style={{
          background: "rgba(255,255,255,0.6)",
          border: `1px solid ${C.line}`,
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 12,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: 20,
              color: C.ink,
            }}
          >
            Spend over time
          </h2>
          <span
            style={{
              fontSize: 11,
              color: C.inkSofter,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: FONT_SANS,
            }}
          >
            peak {formatUsd(maxDay.total_usd)} on {maxDay.day}
          </span>
        </div>
        <Sparkline
          data={data}
          width={1100}
          height={96}
          ariaLabel={`Daily spend over ${data.length} days, peak ${formatUsd(maxDay.total_usd)}`}
        />
        <div
          style={{
            marginTop: 8,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: C.inkSofter,
            fontFamily: FONT_SANS,
          }}
        >
          <span>{summary.by_day[0]?.day}</span>
          <span>{summary.by_day[summary.by_day.length - 1]?.day}</span>
        </div>
      </div>
    </section>
  );
}

function ByCapabilitySection({ summary }: { summary: AdminCostSummary }) {
  if (!summary.by_capability || summary.by_capability.length === 0)
    return null;
  const max = Math.max(
    ...summary.by_capability.map((c) => c.total_usd),
    0.0001,
  );
  // Sort high → low so the eye lands on biggest spend first.
  const sorted = [...summary.by_capability].sort(
    (a, b) => b.total_usd - a.total_usd,
  );
  return (
    <section style={{ marginTop: 32 }}>
      <SectionHeader title="By capability" />
      <div
        style={{
          background: "rgba(255,255,255,0.6)",
          border: `1px solid ${C.line}`,
          borderRadius: 16,
          padding: "12px 24px 18px",
        }}
      >
        {sorted.map((c) => (
          <BarRow
            key={c.capability}
            label={
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <CapabilityBadge capability={c.capability} />
                <span style={{ fontSize: 12, color: C.inkSofter }}>
                  avg {formatDuration(c.avg_duration_ms)}
                </span>
              </span>
            }
            value={`${formatUsd(c.total_usd)} · ${formatInt(c.calls)} calls`}
            fillPct={c.total_usd / max}
          />
        ))}
      </div>
    </section>
  );
}

function TwoUp({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 32,
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 24,
      }}
    >
      <style>{`
        @media (min-width: 1100px) {
          .peterna-admin-twoup { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
      <div
        className="peterna-admin-twoup"
        style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}
      >
        {children}
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionHeader title={title} />
      {children}
    </section>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2
      style={{
        margin: "0 0 12px",
        fontFamily: FONT_DISPLAY,
        fontWeight: 400,
        fontSize: 20,
        color: C.ink,
      }}
    >
      {title}
    </h2>
  );
}

function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <div style={{ marginTop: 12, textAlign: "right" }}>
      <Link
        href={href}
        style={{
          fontFamily: FONT_SANS,
          fontSize: 12,
          color: C.goldDeep,
          textDecoration: "none",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label} →
      </Link>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        padding: "24px 28px",
        borderRadius: 12,
        border: `1px solid ${C.line}`,
        background: "rgba(248,241,228,0.6)",
        color: C.inkSoft,
        fontFamily: FONT_SANS,
        fontSize: 14,
      }}
    >
      {message}
    </div>
  );
}

