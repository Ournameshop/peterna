import type { ReactNode } from "react";

import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";

type Tone = "ink" | "gold" | "sage" | "blush";

const TONES: Record<Tone, { accent: string; tint: string }> = {
  ink: { accent: C.ink, tint: "rgba(42,33,27,0.04)" },
  gold: { accent: C.goldDeep, tint: "rgba(201,169,97,0.10)" },
  sage: { accent: "#6E8268", tint: "rgba(143,166,142,0.12)" },
  blush: { accent: "#A36F58", tint: "rgba(233,213,195,0.35)" },
};

/**
 * Big-number summary tile for the admin overview grid.
 *
 * - `value` is rendered in the display serif; `label` is small caps sans.
 * - `hint` is an optional secondary line (e.g. "12 today" / "2 failures").
 * - `tone` shifts the value color + an accent square; defaults to ink.
 */
export default function StatCard({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  const t = TONES[tone];
  return (
    <div
      style={{
        position: "relative",
        background: "rgba(255,255,255,0.6)",
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        padding: "24px 24px 22px",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: t.tint,
          opacity: 0.6,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative" }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: FONT_SANS,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.inkSofter,
          }}
        >
          {label}
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: FONT_DISPLAY,
            fontSize: "clamp(28px, 3.4vw, 40px)",
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            color: t.accent,
          }}
        >
          {value}
        </div>
        {hint ? (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: C.inkSofter,
              fontFamily: FONT_SANS,
              letterSpacing: "0.02em",
            }}
          >
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );
}
