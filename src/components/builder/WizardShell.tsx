"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { C, FONT_SANS, NARROW_MAX } from "@/lib/peterna-tokens";
import { SHELL_COPY } from "@/lib/library/copy";
import type { StageTag } from "@/lib/builder/state";
import { DURATION, EASE } from "@/lib/builder/motion-tokens";
import StageBanner from "./StageBanner";

// Outer wizard shell: stage banner on top, panel content in the middle,
// quiet "stuck" footer at the bottom. The spec's per-widget "if the form
// sticks" line collapses to this single shell footer for web.
//
// `showBanner` is opt-out for Stage 1.0 (the welcome screen is full-bleed
// and pre-banner). Every screen from intake_returning_user_check onward
// renders the banner.

type Props = {
  stage: StageTag;
  petName: string | null;
  showBanner?: boolean;
  children: ReactNode;
};

export default function WizardShell({
  stage,
  petName,
  showBanner = true,
  children,
}: Props) {
  return (
    <div
      style={{
        background: C.cream,
        color: C.ink,
        paddingTop: 40,
        paddingBottom: 64,
        minHeight: "calc(100vh - 72px)", // leave room for sticky <Nav>
      }}
    >
      <div style={NARROW_MAX}>
        {showBanner ? <StageBanner stage={stage} petName={petName} /> : null}
        <main role="main" aria-live="polite">
          {/* AnimatePresence wraps the active stage so each transitions out
              before the next mounts. `mode="wait"` is required — the wizard
              stages share screen real estate; overlapping them muddies the
              transition. The `key={stage}` change is what triggers the
              presence cycle. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DURATION.base, ease: EASE.soft }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        <p
          style={{
            marginTop: 56,
            textAlign: "center",
            fontFamily: FONT_SANS,
            fontSize: 12,
            color: C.inkSofter,
            letterSpacing: "0.02em",
          }}
        >
          {SHELL_COPY.stuck_footer}
        </p>
      </div>
    </div>
  );
}
