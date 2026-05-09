import type { ReactNode } from "react";
import { C, FONT_SANS } from "@/lib/peterna-tokens";

type Tone = "ink" | "gold" | "sage";

export default function Pill({
  children,
  tone = "ink",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const styles: Record<Tone, { bg: string; color: string; border: string }> = {
    ink: { bg: "rgba(42,33,27,0.04)", color: C.ink, border: C.line },
    gold: {
      bg: "rgba(201,169,97,0.10)",
      color: C.goldDeep,
      border: "rgba(201,169,97,0.3)",
    },
    sage: {
      bg: "rgba(143,166,142,0.12)",
      color: "#6E8268",
      border: "rgba(143,166,142,0.3)",
    },
  };
  const s = styles[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: 11,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.color,
        fontFamily: FONT_SANS,
      }}
    >
      {children}
    </span>
  );
}
