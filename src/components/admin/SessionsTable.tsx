import Link from "next/link";

import { C } from "@/lib/peterna-tokens";
import type { AdminSessionCostRow } from "@/lib/builder/wire-types";

import { NeutralChip } from "./CapabilityBadge";
import {
  rowHoverClass,
  rowHoverCss,
  tableStyle,
  tableWrapStyle,
  tdNumStyle,
  tdStyle,
  thLinkStyle,
  thStyle,
} from "./tableStyles";
import {
  formatInt,
  formatRelative,
  formatUsd,
} from "@/lib/admin/format";

type SortKey = "recent" | "cost" | "calls";

/**
 * Paginated sessions table. Sortable via URL — clicking a header swaps the
 * `?sort=` param (cost / recency / calls). Keeps it a pure server component.
 */
export default function SessionsTable({
  rows,
  sort = "recent",
  basePath = "/admin/sessions",
  extraParams = {},
}: {
  rows: AdminSessionCostRow[];
  sort?: SortKey;
  basePath?: string;
  extraParams?: Record<string, string | undefined>;
}) {
  function sortHref(s: SortKey): string {
    const params = new URLSearchParams();
    params.set("sort", s);
    for (const [k, v] of Object.entries(extraParams)) {
      if (v != null && v !== "") params.set(k, v);
    }
    return `${basePath}?${params.toString()}`;
  }
  function sortIndicator(s: SortKey) {
    return sort === s ? (
      <span aria-hidden="true" style={{ color: C.goldDeep }}>
        ↓
      </span>
    ) : null;
  }

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
        No sessions in this window.
      </div>
    );
  }

  return (
    <div style={tableWrapStyle}>
      <style>{rowHoverCss}</style>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle} scope="col">Pet · User</th>
            <th style={thStyle} scope="col">Stage</th>
            <th style={{ ...thStyle, textAlign: "right" }} scope="col">
              <Link href={sortHref("cost")} style={thLinkStyle}>
                Cost {sortIndicator("cost")}
              </Link>
            </th>
            <th style={{ ...thStyle, textAlign: "right" }} scope="col">
              <Link href={sortHref("calls")} style={thLinkStyle}>
                Calls {sortIndicator("calls")}
              </Link>
            </th>
            <th style={thStyle} scope="col">
              <Link href={sortHref("recent")} style={thLinkStyle}>
                Updated {sortIndicator("recent")}
              </Link>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const href = `/admin/sessions/${r.session_id}`;
            return (
              <tr key={r.session_id} className={rowHoverClass}>
                <td style={tdStyle}>
                  <Link href={href} className="row-link">
                    <div style={{ fontWeight: 500 }}>
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
                <td style={tdStyle}>
                  <NeutralChip>{r.stage.replace(/_/g, " ")}</NeutralChip>
                  {r.is_complete ? (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 11,
                        color: "#6E8268",
                      }}
                    >
                      complete
                    </span>
                  ) : null}
                </td>
                <td style={tdNumStyle}>
                  <Link href={href} className="row-link">
                    {formatUsd(r.total_usd)}
                  </Link>
                </td>
                <td style={tdNumStyle}>
                  <Link href={href} className="row-link">
                    {formatInt(r.call_count)}
                    {r.failure_count > 0 ? (
                      <span
                        style={{
                          marginLeft: 6,
                          color: "#B0664D",
                          fontSize: 11,
                        }}
                      >
                        ({r.failure_count} failed)
                      </span>
                    ) : null}
                  </Link>
                </td>
                <td style={{ ...tdStyle, color: C.inkSofter, fontSize: 12 }}>
                  <Link href={href} className="row-link">
                    {formatRelative(r.updated_at)}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
