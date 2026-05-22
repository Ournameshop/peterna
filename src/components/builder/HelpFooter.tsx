"use client";

import { useEffect, useRef, useState } from "react";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";

// Quiet help affordance. Replaces the persistent "Having trouble? Refresh —
// your work is saved." footer text that previously sat at the bottom of every
// wizard screen.
//
// Per audit CC-6: the old footer was the lowest-contrast element on every page
// but, because it was the only persistent piece of system voice, the eye kept
// landing on it — framing the wizard as "this might break."
//
// New shape:
//   - Collapsed default: a 36x36 circular `?` icon button, bottom-right of the
//     wizard shell (position: fixed). Cream bg, hairline C.line border.
//   - On click: expands a 240px panel above-left of the button with the
//     refresh sentence + a quiet `Get help` mailto link.
//   - Closes on outside click, ESC, or the in-panel × close.
//
// No portals — just a fixed-positioned div. The wizard never needs to
// stack against a modal so z-index 60 is sufficient.

export default function HelpFooter() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // ESC + outside-click dismissal.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
      }}
    >
      {open ? (
        <div
          role="dialog"
          aria-label="Help"
          style={{
            width: 240,
            background: C.cream,
            border: `1px solid ${C.line}`,
            borderRadius: 14,
            padding: "14px 16px 16px",
            boxShadow: "0 8px 28px rgba(42, 33, 27, 0.10)",
            position: "relative",
            color: C.ink,
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close help"
            style={{
              position: "absolute",
              top: 8,
              right: 10,
              width: 22,
              height: 22,
              border: "none",
              background: "transparent",
              color: C.inkSofter,
              fontFamily: FONT_SANS,
              fontSize: 16,
              lineHeight: 1,
              cursor: "pointer",
              padding: 0,
              borderRadius: 4,
            }}
          >
            ×
          </button>

          <p
            style={{
              fontFamily: FONT_DISPLAY,
              fontStyle: "italic",
              fontSize: 14,
              lineHeight: 1.4,
              color: C.ink,
              margin: "0 0 8px",
              paddingRight: 16,
              fontWeight: 400,
            }}
          >
            If anything sticks…
          </p>
          <p
            style={{
              fontFamily: FONT_SANS,
              fontSize: 13,
              lineHeight: 1.55,
              color: C.inkSoft,
              margin: "0 0 10px",
            }}
          >
            Refresh — your work is saved. We hold every step on the server
            until you tell us to forget it.
          </p>
          <a
            href="mailto:support@peterna.com"
            style={{
              fontFamily: FONT_SANS,
              fontSize: 13,
              color: C.goldDeep,
              textDecoration: "underline",
              textUnderlineOffset: 3,
              fontWeight: 500,
            }}
          >
            Get help
          </a>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close help" : "Open help"}
        aria-expanded={open}
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: C.cream,
          border: `1px solid ${C.line}`,
          color: C.inkSoft,
          fontFamily: FONT_SANS,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          boxShadow: "0 2px 10px rgba(42, 33, 27, 0.06)",
        }}
      >
        ?
      </button>
    </div>
  );
}
