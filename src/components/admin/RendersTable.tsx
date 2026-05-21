import Link from "next/link";

import { C } from "@/lib/peterna-tokens";
import type { AdminRenderRow } from "@/lib/builder/wire-types";

import CapabilityBadge, { NeutralChip } from "./CapabilityBadge";
import {
  rowHoverClass,
  rowHoverCss,
  tableStyle,
  tableWrapStyle,
  tdNumStyle,
  tdStyle,
  thStyle,
} from "./tableStyles";
import {
  formatDuration,
  formatRelative,
  formatUsd,
} from "@/lib/admin/format";

/**
 * Audit-log table. Each row has stage, capability, vendor_served, model,
 * cost, duration, and an error pill if the call failed. The session column
 * is a deep link into the session drill-down. The `response_url` link, when
 * present, opens the rendered asset in a new tab.
 */
export default function RendersTable({
  rows,
  showSession = true,
}: {
  rows: AdminRenderRow[];
  showSession?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          ...tableWrapStyle,
          padding: "32px 24px",
          textAlign: "center",
          color: C.inkSofter,
          fontSize: 14,
        }}
      >
        No renders matching these filters.
      </div>
    );
  }

  return (
    <div style={tableWrapStyle}>
      <style>{rowHoverCss}</style>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle} scope="col">When</th>
            {showSession ? <th style={thStyle} scope="col">Session</th> : null}
            <th style={thStyle} scope="col">Stage</th>
            <th style={thStyle} scope="col">Capability</th>
            <th style={thStyle} scope="col">Vendor</th>
            <th style={thStyle} scope="col">Model</th>
            <th style={{ ...thStyle, textAlign: "right" }} scope="col">Cost</th>
            <th style={{ ...thStyle, textAlign: "right" }} scope="col">Duration</th>
            <th style={thStyle} scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={rowHoverClass}>
              <td style={{ ...tdStyle, color: C.inkSofter, fontSize: 12, whiteSpace: "nowrap" }}>
                {formatRelative(r.created_at)}
              </td>
              {showSession ? (
                <td style={tdStyle}>
                  <Link
                    href={`/admin/sessions/${r.session_id}`}
                    className="row-link"
                  >
                    <div style={{ fontSize: 13 }}>
                      {r.pet_name || (
                        <span style={{ color: C.inkSofter, fontStyle: "italic" }}>
                          Untitled
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: C.inkSofter,
                        marginTop: 2,
                      }}
                    >
                      {r.user_email ?? "anonymous"}
                    </div>
                  </Link>
                </td>
              ) : null}
              <td style={tdStyle}>
                <NeutralChip>{r.stage.replace(/_/g, " ")}</NeutralChip>
              </td>
              <td style={tdStyle}>
                <CapabilityBadge capability={r.capability} />
              </td>
              <td style={tdStyle}>
                {r.vendor_served ? (
                  <VendorCell
                    served={r.vendor_served}
                    attempted={r.vendor_attempted}
                  />
                ) : (
                  <span style={{ color: C.inkSofter, fontSize: 12 }}>—</span>
                )}
              </td>
              <td style={{ ...tdStyle, fontSize: 12, color: C.inkSoft }}>
                {r.model ?? "—"}
              </td>
              <td style={tdNumStyle}>
                {r.cost_usd_est != null ? formatUsd(r.cost_usd_est) : "—"}
              </td>
              <td style={tdNumStyle}>{formatDuration(r.duration_ms)}</td>
              <td style={tdStyle}>
                {r.error ? (
                  <ErrorBadge text={r.error} />
                ) : r.response_url ? (
                  <a
                    href={r.response_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 12,
                      color: C.goldDeep,
                      textDecoration: "none",
                    }}
                  >
                    open ↗
                  </a>
                ) : (
                  <span style={{ color: "#6E8268", fontSize: 12 }}>ok</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VendorCell({
  served,
  attempted,
}: {
  served: string;
  attempted: string[];
}) {
  // If the served vendor isn't the first one attempted, this was a fallback.
  // Surface it inline so the audit log makes vendor health visible at scan.
  const isFallback =
    attempted.length > 0 && attempted[0] !== served;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <NeutralChip>{served}</NeutralChip>
      {isFallback ? (
        <span
          title={`Fallback — first tried ${attempted[0]}`}
          style={{
            fontSize: 10,
            color: C.goldDeep,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          fallback
        </span>
      ) : null}
    </span>
  );
}

function ErrorBadge({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#A35040",
        background: "rgba(163,80,64,0.08)",
        border: "1px solid rgba(163,80,64,0.25)",
        maxWidth: 220,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={text}
    >
      {text}
    </span>
  );
}
