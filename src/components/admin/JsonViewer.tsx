"use client";

import { useState } from "react";

import { C, FONT_SANS } from "@/lib/peterna-tokens";

/**
 * Collapsible JSON viewer. We deliberately avoid bringing in a JSON-tree
 * library — request_body payloads are small (intake hints, prompt
 * fragments) and the monospace `JSON.stringify(_, null, 2)` is fine to skim.
 */
export default function JsonViewer({
  value,
  label = "Request body",
  initiallyOpen = false,
}: {
  value: unknown;
  label?: string;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  // Defensive — if value is undefined, render nothing.
  if (value == null) {
    return (
      <span style={{ fontSize: 12, color: C.inkSofter }}>—</span>
    );
  }
  let pretty: string;
  try {
    pretty = JSON.stringify(value, null, 2);
  } catch {
    pretty = String(value);
  }
  return (
    <div style={{ fontFamily: FONT_SANS }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          appearance: "none",
          border: `1px solid ${C.line}`,
          background: "rgba(255,255,255,0.6)",
          color: C.inkSoft,
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          padding: "4px 10px",
          borderRadius: 999,
          cursor: "pointer",
        }}
      >
        {open ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
      </button>
      {open ? (
        <pre
          style={{
            marginTop: 8,
            padding: 12,
            background: "rgba(42,33,27,0.04)",
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            fontSize: 11,
            lineHeight: 1.5,
            maxHeight: 360,
            overflow: "auto",
            color: C.ink,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {pretty}
        </pre>
      ) : null}
    </div>
  );
}
