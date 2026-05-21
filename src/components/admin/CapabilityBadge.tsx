import { C, FONT_SANS } from "@/lib/peterna-tokens";

// Capability badge — small uppercase chip. Color depends on capability so
// the audit log scans visually. Falls back to neutral ink for unknowns.

const PALETTE: Record<string, { color: string; bg: string; border: string }> = {
  image: {
    color: C.goldDeep,
    bg: "rgba(201,169,97,0.12)",
    border: "rgba(201,169,97,0.3)",
  },
  vision: {
    color: "#6E8268",
    bg: "rgba(143,166,142,0.14)",
    border: "rgba(143,166,142,0.3)",
  },
  video: {
    color: "#A36F58",
    bg: "rgba(233,213,195,0.45)",
    border: "rgba(199,156,131,0.4)",
  },
  text: {
    color: C.inkSoft,
    bg: "rgba(42,33,27,0.05)",
    border: C.line,
  },
};

function paletteFor(capability: string): {
  color: string;
  bg: string;
  border: string;
} {
  const key = capability.toLowerCase();
  // Allow loose matching — `image-gen` or `image_generation` should both
  // render with the gold palette. We pick by leading token.
  if (key.startsWith("image")) return PALETTE.image;
  if (key.startsWith("vision")) return PALETTE.vision;
  if (key.startsWith("video")) return PALETTE.video;
  if (key.startsWith("text") || key.startsWith("llm")) return PALETTE.text;
  return {
    color: C.inkSoft,
    bg: "rgba(42,33,27,0.04)",
    border: C.line,
  };
}

export default function CapabilityBadge({
  capability,
}: {
  capability: string;
}) {
  const p = paletteFor(capability);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 10,
        fontFamily: FONT_SANS,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: p.color,
        background: p.bg,
        border: `1px solid ${p.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {capability}
    </span>
  );
}

// Generic small chip used for vendor / stage labels — neutral tone.
export function NeutralChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 10,
        fontFamily: FONT_SANS,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: C.inkSoft,
        background: "rgba(42,33,27,0.04)",
        border: `1px solid ${C.line}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
