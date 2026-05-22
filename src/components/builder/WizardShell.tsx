"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { C, NARROW_MAX } from "@/lib/peterna-tokens";
import type { StageTag } from "@/lib/builder/state";
import { DURATION, EASE } from "@/lib/builder/motion-tokens";
import StageBanner from "./StageBanner";
import BuilderProgressRail from "./BuilderProgressRail";
import HelpFooter from "./HelpFooter";

// Outer wizard shell: progress rail, stage banner, panel content, and a
// quiet help affordance pinned to the corner. The spec's per-widget "if the
// form sticks" line collapses to the single HelpFooter for web (audit CC-6).
//
// `showBanner` is opt-out for Stage 1.0 (the welcome screen is full-bleed
// pre-banner and intentionally chrome-less per audit). Every screen from
// intake_returning_user_check onward renders the banner + the rail.

type Props = {
  stage: StageTag;
  petName: string | null;
  showBanner?: boolean;
  children: ReactNode;
};

// Global :focus-visible ring. Inlined here so the wizard root always has a
// keyboard-visible focus indicator (audit CC-8). Gold-keyed, 2px, 2px offset.
// Template-stringed from C.gold so we don't drift from the token. Skipped
// transition keeps it instant — respects prefers-reduced-motion implicitly.
const FOCUS_RING_CSS = `
  .peterna-wizard-root button:focus-visible,
  .peterna-wizard-root a:focus-visible,
  .peterna-wizard-root [role="button"]:focus-visible,
  .peterna-wizard-root input:focus-visible,
  .peterna-wizard-root textarea:focus-visible,
  .peterna-wizard-root [tabindex]:focus-visible {
    outline: 2px solid ${C.gold};
    outline-offset: 2px;
    border-radius: inherit;
    transition: none;
  }
`;

export default function WizardShell({
  stage,
  petName,
  showBanner = true,
  children,
}: Props) {
  // The welcome screen suppresses all chrome — the WelcomePanel above carries
  // the entire moment. `showBanner` doubles as our chrome flag because Stage
  // 1.0 is the only screen that hides the banner.
  const showChrome = showBanner;

  return (
    <div
      className="peterna-wizard-root"
      style={{
        background: C.cream,
        color: C.ink,
        paddingTop: 40,
        paddingBottom: 64,
        minHeight: "calc(100vh - 72px)", // leave room for sticky <Nav>
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: FOCUS_RING_CSS }} />
      <div style={NARROW_MAX}>
        {showChrome ? <BuilderProgressRail currentStage={stage} /> : null}
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
      </div>
      {showChrome ? <HelpFooter /> : null}
    </div>
  );
}
