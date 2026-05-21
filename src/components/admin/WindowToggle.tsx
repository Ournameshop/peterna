import Link from "next/link";

import { C, FONT_SANS } from "@/lib/peterna-tokens";
import type { AdminCostWindow } from "@/lib/builder/wire-types";

const OPTIONS: ReadonlyArray<{ key: AdminCostWindow; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

/**
 * Four pills for time-window selection. URL-driven (no client state) — the
 * page reads `?window=` from `searchParams` and links each pill to the same
 * route with the new value. Lets the whole admin section stay RSC.
 */
export default function WindowToggle({
  active,
  basePath,
  extraParams = {},
}: {
  active: AdminCostWindow;
  basePath: string;
  extraParams?: Record<string, string | undefined>;
}) {
  function hrefFor(w: AdminCostWindow): string {
    const params = new URLSearchParams();
    params.set("window", w);
    for (const [k, v] of Object.entries(extraParams)) {
      if (v != null && v !== "") params.set(k, v);
    }
    return `${basePath}?${params.toString()}`;
  }
  return (
    <div
      role="tablist"
      aria-label="Time window"
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 4,
        background: "rgba(255,255,255,0.6)",
        border: `1px solid ${C.line}`,
        borderRadius: 999,
        fontFamily: FONT_SANS,
      }}
    >
      {OPTIONS.map((o) => {
        const isActive = o.key === active;
        return (
          <Link
            key={o.key}
            href={hrefFor(o.key)}
            role="tab"
            aria-selected={isActive}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              fontSize: 12,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textDecoration: "none",
              color: isActive ? C.ink : C.inkSofter,
              background: isActive ? "rgba(143,166,142,0.22)" : "transparent",
              border: `1px solid ${isActive ? "rgba(143,166,142,0.35)" : "transparent"}`,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
