import Link from "next/link";

import { C, FONT_SANS } from "@/lib/peterna-tokens";

/**
 * Server-driven pagination. The page passes `limit`, `offset`, `total`, and
 * the base path; this builds prev/next links that preserve any extra query
 * params. Pure links — no client state.
 */
export default function Pagination({
  basePath,
  limit,
  offset,
  total,
  extraParams = {},
}: {
  basePath: string;
  limit: number;
  offset: number;
  total: number;
  extraParams?: Record<string, string | undefined>;
}) {
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, total);

  function hrefFor(newOffset: number): string {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (newOffset > 0) params.set("offset", String(newOffset));
    for (const [k, v] of Object.entries(extraParams)) {
      if (v != null && v !== "") params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const btnStyle = {
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${C.line}`,
    background: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: FONT_SANS,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: C.ink,
    textDecoration: "none",
  };
  const disabledStyle = {
    ...btnStyle,
    color: C.inkSofter,
    pointerEvents: "none" as const,
    opacity: 0.5,
  };

  return (
    <nav
      aria-label="Pagination"
      style={{
        marginTop: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        fontFamily: FONT_SANS,
        fontSize: 12,
        color: C.inkSofter,
      }}
    >
      <div style={{ fontVariantNumeric: "tabular-nums" }}>
        {total > 0 ? (
          <>
            <span style={{ color: C.ink }}>
              {start.toLocaleString()}–{end.toLocaleString()}
            </span>{" "}
            of {total.toLocaleString()}
          </>
        ) : (
          "No results"
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {hasPrev ? (
          <Link href={hrefFor(Math.max(0, offset - limit))} style={btnStyle}>
            ← Prev
          </Link>
        ) : (
          <span style={disabledStyle}>← Prev</span>
        )}
        {hasNext ? (
          <Link href={hrefFor(offset + limit)} style={btnStyle}>
            Next →
          </Link>
        ) : (
          <span style={disabledStyle}>Next →</span>
        )}
      </div>
    </nav>
  );
}
