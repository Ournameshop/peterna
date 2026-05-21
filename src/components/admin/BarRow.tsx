import type { ReactNode } from "react";

import { C, FONT_SANS } from "@/lib/peterna-tokens";

// Horizontal bar row. Used on the overview "by capability" list.
// `fillPct` is 0..1; we clamp before painting.

type Props = {
  label: ReactNode;
  value: ReactNode;
  /** 0..1 — how much of the bar is filled. Clamped. */
  fillPct: number;
  /** Bar fill color; defaults to sage. */
  color?: string;
  /** Optional supporting text below the bar. */
  sublabel?: ReactNode;
};

export default function BarRow({
  label,
  value,
  fillPct,
  color = C.sage,
  sublabel,
}: Props) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(fillPct) ? fillPct : 0));
  const percentLabel = `${Math.round(pct * 100)}%`;
  return (
    <div
      role="group"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 0",
        borderBottom: `1px solid ${C.line}`,
        fontFamily: FONT_SANS,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 16,
          fontSize: 13,
          color: C.ink,
        }}
      >
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span style={{ color: C.inkSofter, fontVariantNumeric: "tabular-nums" }}>
          {value}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={typeof label === "string" ? `${label}: ${percentLabel}` : percentLabel}
        style={{
          width: "100%",
          height: 6,
          background: "rgba(229,219,201,0.5)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      {sublabel ? (
        <div style={{ fontSize: 11, color: C.inkSofter, letterSpacing: "0.02em" }}>
          {sublabel}
        </div>
      ) : null}
    </div>
  );
}
