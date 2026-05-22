// Peterna design tokens — source of truth from the artifact.
// Inline-style approach is preserved across components for visual fidelity.

export const C = {
  cream: "#F8F1E4",
  // Slightly brighter cream used as the "raised surface" tint — for the
  // Stage 1.0 welcome panel, the dropzone, share blocks, and any card that
  // needs a quiet "this is a contained moment" treatment without a shadow.
  // Replaces the raw `#FFFBF3` hex that was previously duplicated across
  // PhotoUrlField, PillPicker, ConfirmationCard, AssemblyView, EulogyView,
  // CardPreviewView, CharacterSheetView, CombinationPreviewReview, and
  // DeliveryReadyView. Per audit CC-1 / CC-9.
  creamRaised: "#FFFBF3",
  blush: "#E9D5C3",
  ink: "#2A211B",
  inkSoft: "#4A3F36",
  inkSofter: "#7A6F66",
  sage: "#8FA68E",
  gold: "#C9A961",
  goldDeep: "#A88841",
  line: "#E5DBC9",
  // Gold-tinted glow used on hover / drag-over / selected-rich-pill states.
  // Two stops — 8% for the very quiet tints, 18% for the badge / selected
  // chip backgrounds. Replaces raw rgba(201, 169, 97, 0.08 / 0.18) repeats.
  goldGlow8: "rgba(201, 169, 97, 0.08)",
  goldGlow18: "rgba(201, 169, 97, 0.18)",
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
