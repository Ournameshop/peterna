// Peterna design tokens — source of truth from the artifact.
// Inline-style approach is preserved across components for visual fidelity.

export const C = {
  cream: "#F8F1E4",
  blush: "#E9D5C3",
  ink: "#2A211B",
  inkSoft: "#4A3F36",
  inkSofter: "#7A6F66",
  sage: "#8FA68E",
  gold: "#C9A961",
  goldDeep: "#A88841",
  line: "#E5DBC9",
} as const;

export const FONT_DISPLAY =
  "'Cormorant Garamond', Garamond, Georgia, serif";
export const FONT_SANS =
  "'Inter', system-ui, -apple-system, sans-serif";

export const sectionMaxStyle = {
  maxWidth: 1320,
  margin: "0 auto",
  padding: "0 40px",
} as const;

export const PAGE_MAX = sectionMaxStyle;

export const NARROW_MAX = {
  maxWidth: 900,
  margin: "0 auto",
  padding: "0 40px",
} as const;
