"use client";

import { C, FONT_DISPLAY } from "@/lib/peterna-tokens";
import { WELCOME_LINES, substitutePetName } from "@/lib/library/copy";

// Stage 1.0 anti-trauma welcome.
//
// The copy is LOCKED VERBATIM (spec §1.0). The treatment here:
//   - full-bleed centered panel
//   - FONT_DISPLAY (Cormorant Garamond), italic for warmth
//   - warm cream background (matches body)
//   - NO continue button — the user advances by interacting with the
//     intake form rendered BELOW this panel by WizardShell.

type Props = {
  petName: string | null;
};

export default function WelcomePanel({ petName }: Props) {
  return (
    <section
      aria-label="A note before we begin"
      style={{
        background: C.cream,
        padding: "56px 24px 40px",
        borderBottom: `1px solid ${C.line}`,
        marginBottom: 40,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          textAlign: "center",
          color: C.ink,
        }}
      >
        {/* Line 1 — pet name, framing as collaborative work. */}
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontStyle: "italic",
            fontSize: 32,
            lineHeight: 1.35,
            color: C.ink,
            margin: "0 0 28px",
            fontWeight: 400,
            letterSpacing: "-0.005em",
          }}
        >
          {substitutePetName(WELCOME_LINES[0], petName)}
        </p>

        {/* Line 2 — anti-trauma frame. Slightly smaller, ink-soft. */}
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 22,
            lineHeight: 1.55,
            color: C.inkSoft,
            margin: "0 0 22px",
            fontWeight: 400,
          }}
        >
          {WELCOME_LINES[1]}
        </p>

        {/* Line 3 — pace, skippability, reversibility. */}
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 22,
            lineHeight: 1.55,
            color: C.inkSoft,
            margin: "0 0 32px",
            fontWeight: 400,
          }}
        >
          {WELCOME_LINES[2]}
        </p>

        {/* Line 4 — hands control back to the user. Italic call-out. */}
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontStyle: "italic",
            fontSize: 24,
            lineHeight: 1.4,
            color: C.goldDeep,
            margin: 0,
            fontWeight: 400,
          }}
        >
          {WELCOME_LINES[3]}
        </p>
      </div>
    </section>
  );
}
