import type { CSSProperties } from "react";

import { C, FONT_SANS } from "@/lib/peterna-tokens";

// Shared table primitives. Importing from a single module keeps the three
// admin tables visually consistent without re-declaring 8 inline style
// objects per file.

export const tableWrapStyle: CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.6)",
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  overflow: "hidden",
  fontFamily: FONT_SANS,
};

export const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: 13,
  color: C.ink,
};

export const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: C.inkSofter,
  background: "rgba(229,219,201,0.35)",
  borderBottom: `1px solid ${C.line}`,
};

export const thLinkStyle: CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

export const tdStyle: CSSProperties = {
  padding: "12px 14px",
  borderBottom: `1px solid ${C.line}`,
  verticalAlign: "middle",
};

export const tdNumStyle: CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

export const tdMutedStyle: CSSProperties = {
  ...tdStyle,
  color: C.inkSofter,
};

export const rowHoverClass = "peterna-admin-row";

/**
 * One-off hover CSS — injected once per page. Inline styles can't do :hover,
 * and we only need a single row of CSS.
 */
export const rowHoverCss = `
  tr.${rowHoverClass}:hover td {
    background: rgba(143,166,142,0.06);
  }
  tr.${rowHoverClass} a.row-link {
    color: inherit;
    text-decoration: none;
  }
  tr.${rowHoverClass} a.row-link:hover {
    text-decoration: underline;
  }
`;
