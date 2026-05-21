import Link from "next/link";

import { C } from "@/lib/peterna-tokens";
import type { AdminUserCostRow } from "@/lib/builder/wire-types";

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

type SortKey = "recent" | "cost" | "tributes";

export default function UsersTable({
  rows,
  sort = "recent",
  basePath = "/admin/users",
  extraParams = {},
}: {
  rows: AdminUserCostRow[];
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
        No users yet.
      </div>
    );
  }

  return (
    <div style={tableWrapStyle}>
      <style>{rowHoverCss}</style>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle} scope="col">User</th>
            <th style={{ ...thStyle, textAlign: "right" }} scope="col">
              <Link href={sortHref("tributes")} style={thLinkStyle}>
                Tributes {sortIndicator("tributes")}
              </Link>
            </th>
            <th style={{ ...thStyle, textAlign: "right" }} scope="col">
              Completed
            </th>
            <th style={{ ...thStyle, textAlign: "right" }} scope="col">
              <Link href={sortHref("cost")} style={thLinkStyle}>
                Total cost {sortIndicator("cost")}
              </Link>
            </th>
            <th style={thStyle} scope="col">
              <Link href={sortHref("recent")} style={thLinkStyle}>
                Last active {sortIndicator("recent")}
              </Link>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const href = `/admin/users/${u.user_id}`;
            return (
              <tr key={u.user_id} className={rowHoverClass}>
                <td style={tdStyle}>
                  <Link href={href} className="row-link">
                    <div style={{ fontWeight: 500 }}>{u.email}</div>
                    {u.name ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: C.inkSofter,
                          marginTop: 2,
                        }}
                      >
                        {u.name}
                      </div>
                    ) : null}
                  </Link>
                </td>
                <td style={tdNumStyle}>{formatInt(u.tribute_count)}</td>
                <td style={tdNumStyle}>{formatInt(u.completed_tribute_count)}</td>
                <td style={tdNumStyle}>{formatUsd(u.total_usd)}</td>
                <td style={{ ...tdStyle, color: C.inkSofter, fontSize: 12 }}>
                  {u.last_active_at
                    ? formatRelative(u.last_active_at)
                    : "never"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
