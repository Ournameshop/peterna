"use client";

import { motion } from "framer-motion";
import { C, FONT_DISPLAY } from "@/lib/peterna-tokens";
import { WELCOME_LINES, substitutePetName } from "@/lib/library/copy";
import {
  DURATION,
  EASE,
  fadeUp,
  revealPanel,
  staggerChildren,
} from "@/lib/builder/motion-tokens";
import { AffirmBtn } from "./buttons";

// Stage 1.0 anti-trauma welcome.
//
// Per audit CC-1 / CC-3: the welcome was cream-on-cream with a CTA rendered
// below as a single-pill PillPicker — reading as a content header rather than
// a held moment, and the CTA reading as disabled. This rebuild treats the
// welcome as a distinct surface envelope:
//   - C.surface (tinted cream) panel with hairline C.line border + 24px radius
//   - Generous interior padding (~56/48 desktop)
//   - The CTA lives INSIDE the panel, anchored to "Ready when you are."
//   - Mount choreography: revealPanel container + staggerChildren cascade so
//     each line / the gold rule / the CTA fade up in sequence. Honors
//     prefers-reduced-motion via the motion-tokens helpers.
//   - Italic is reserved for headlines (lines 1 + 4 only — line 4 is the
//     emotional beat). Lines 2 + 3 stay upright Cormorant Garamond.

type Props = {
  petName: string | null;
  onBegin: () => void;
};

export default function WelcomePanel({ petName, onBegin }: Props) {
  const containerVariants = staggerChildren(0.08, 0.04);
  const childVariants = fadeUp(8);
  const panelVariants = revealPanel();

  return (
    <section
      aria-label="A note before we begin"
      style={{
        padding: "48px 20px 24px",
        marginBottom: 32,
      }}
    >
      <motion.div
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        style={{
          maxWidth: 720,
          margin: "0 auto",
          background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: 24,
          // Desktop padding; falls back gracefully on mobile via the clamp
          // on the inner container.
          padding: "clamp(40px, 6vw, 56px) clamp(24px, 4vw, 48px)",
          textAlign: "center",
          color: C.ink,
        }}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          {/* Line 1 — italic headline; pet name + collaborative framing. */}
          <motion.p
            variants={childVariants}
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
          </motion.p>

          {/* Line 2 — upright body; anti-trauma frame. ~17px desktop. */}
          <motion.p
            variants={childVariants}
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 17,
              lineHeight: 1.6,
              color: C.inkSoft,
              margin: "0 0 18px",
              fontWeight: 400,
            }}
          >
            {WELCOME_LINES[1]}
          </motion.p>

          {/* Line 3 — upright body; pace, skippability, reversibility. */}
          <motion.p
            variants={childVariants}
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 17,
              lineHeight: 1.6,
              color: C.inkSoft,
              margin: "0 0 28px",
              fontWeight: 400,
            }}
          >
            {WELCOME_LINES[2]}
          </motion.p>

          {/* Thin gold rule — visual anchor before the held beat + CTA. */}
          <motion.div
            variants={childVariants}
            aria-hidden="true"
            style={{
              width: 56,
              height: 1,
              background: C.gold,
              margin: "0 0 28px",
              opacity: 0.85,
            }}
          />

          {/* Line 4 — italic held beat. */}
          <motion.p
            variants={childVariants}
            style={{
              fontFamily: FONT_DISPLAY,
              fontStyle: "italic",
              fontSize: 24,
              lineHeight: 1.4,
              color: C.goldDeep,
              margin: "0 0 28px",
              fontWeight: 400,
            }}
          >
            {WELCOME_LINES[3]}
          </motion.p>

          {/* CTA — gold-keyed affirmation, anchored inside the panel. */}
          <motion.div
            variants={childVariants}
            transition={{ duration: DURATION.base, ease: EASE.soft }}
          >
            <AffirmBtn onClick={onBegin} ariaLabel="Start when you're ready">
              Start when you&apos;re ready
            </AffirmBtn>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
