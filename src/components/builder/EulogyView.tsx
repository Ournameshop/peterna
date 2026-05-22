"use client";

import { type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { EULOGY, substitutePetName } from "@/lib/library/copy";
import { DURATION, EASE, fadeIn } from "@/lib/builder/motion-tokens";
import GateReview, { type GateAction } from "./GateReview";

// Stage 8 — Eulogy PDF.
//
// Two modes:
//   - loading: "Composing the eulogy for [PET_NAME]…" while
//     POST /api/eulogy/render is in flight. Server-side templating is cheap
//     compared to image renders, but it's still slow enough that we set
//     "about a minute" expectations in the hint.
//   - review: the PDF embedded in an <iframe> with a GateReview gate. Pills
//     are "It's perfect" (approve), "Re-render the PDF" (clear + re-enter
//     loading), "Edit the words" (bounce back to Stage 5.5 — the
//     BuilderClient owns that destination).
//
// PDF embed strategy:
//   - We use a plain <iframe src={pdfUrl}> rather than pdf.js. Modern
//     browsers (Chromium, Firefox, Safari ≥15) render PDFs inline via the
//     native plugin; the iframe gives us their controls (zoom, page nav,
//     download) for free without a dependency. Mobile Safari and some
//     mobile Chromiums refuse to inline-render PDFs and will show a blank
//     pane; the "Open in new tab" link below the iframe is the fallback.
//   - The iframe is given a fixed aspect via `aspect-ratio: 8.5 / 11` (US
//     Letter portrait) so the layout doesn't jump when the PDF loads.
//
// No vendor names; no "PDFKit" — we say "the eulogy" / "the PDF."

export type EulogyMode = "loading" | "review";
export type EulogyAction = "approve" | "rerender" | "restart_words";

type Props = {
  petName: string | null;
  mode: EulogyMode;
  /** PDF public URL (required in review mode). */
  pdfUrl?: string | null;
  /** Disable approve while a side-effect is in flight. */
  disabled?: boolean;
  /** Called with the picked gate action. */
  onAction: (action: EulogyAction) => void;
};

export default function EulogyView({
  petName,
  mode,
  pdfUrl,
  disabled = false,
  onAction,
}: Props) {
  if (mode === "loading" || !pdfUrl) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="loading"
          variants={fadeIn()}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <ComposingLoadingPanel petName={petName} />
        </motion.div>
      </AnimatePresence>
    );
  }

  const headline = substitutePetName(EULOGY.review.headline, petName);
  const subhead = EULOGY.review.subhead;

  const actions: GateAction[] = [
    {
      id: "approve",
      label: EULOGY.review.pills.approve,
      variant: "affirm",
    },
    {
      id: "rerender",
      label: EULOGY.review.pills.rerender,
      variant: "quiet",
    },
    {
      id: "restart_words",
      label: EULOGY.review.pills.restart_words,
      variant: "quiet",
    },
  ];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="review"
        variants={fadeIn()}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <GateReview
          headline={headline}
          subhead={subhead}
          actions={actions}
          onAction={(id) => onAction(id as EulogyAction)}
          pillsHint={EULOGY.review.pills_hint}
          disabled={disabled}
          ariaLabel={`Eulogy review for ${petName ?? "your pet"}`}
          staggerPills
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{
              opacity: 1,
              scale: [0.97, 1, 1.005, 1],
              y: 0,
              transition: {
                opacity: { duration: DURATION.long, ease: EASE.reveal },
                y: { duration: DURATION.long, ease: EASE.reveal },
                scale: {
                  duration: DURATION.long + DURATION.slow,
                  ease: EASE.reveal,
                  times: [0, 0.6, 0.8, 1],
                },
              },
            }}
            style={pdfFrameWrap}
          >
            <iframe
              // `#view=FitH` is a PDF.js / native PDF viewer fragment that asks
              // the embedded viewer to fit-to-width. Browsers that don't honor
              // it fall back to their default zoom, which is also fine.
              src={`${pdfUrl}#view=FitH`}
              title={`Eulogy PDF for ${petName ?? "your pet"}`}
              style={pdfFrameStyle}
              // The eulogy is a same-origin asset on our R2 bucket — no
              // sandbox needed, but we add `loading="lazy"` so the iframe
              // doesn't block render on this page.
              loading="lazy"
            />
            <p style={pdfFallback}>
              {/* Fallback for browsers (mostly mobile) that won't inline-render
                  PDFs. The link opens in a new tab where the device's default PDF
                  viewer takes over. */}
              PDF not loading?{" "}
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={pdfFallbackLink}
              >
                Open it in a new tab
              </a>
              .
            </p>
          </motion.div>
        </GateReview>
      </motion.div>
    </AnimatePresence>
  );
}

// -----------------------------------------------------------------------------
// Loading panel — "Composing the eulogy for [PET_NAME]…"
// -----------------------------------------------------------------------------

function ComposingLoadingPanel({ petName }: { petName: string | null }) {
  const line = substitutePetName(EULOGY.loading, petName);
  return (
    <div role="status" aria-live="polite" style={loadingWrap}>
      <div aria-hidden="true" style={spinnerStyle} />
      <p style={loadingHeadline}>{line}</p>
      <p style={loadingHint}>{EULOGY.loading_hint}</p>
      <style>{`@keyframes peternaSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const pdfFrameWrap: CSSProperties = {
  width: "100%",
  // US Letter portrait — 8.5 × 11. We use aspect-ratio so the iframe holds
  // its place during PDF load, preventing layout jump.
  maxWidth: 720,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const pdfFrameStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "8.5 / 11",
  borderRadius: 12,
  border: `1px solid ${C.line}`,
  background: "#FFFBF3",
  // Block-level so it sits flush within the flex column.
  display: "block",
};

const pdfFallback: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: C.inkSofter,
  textAlign: "center",
};

const pdfFallbackLink: CSSProperties = {
  color: C.inkSoft,
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const loadingWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 18,
  padding: "64px 16px",
  minHeight: 360,
};

const spinnerStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "2px solid rgba(0,0,0,0.08)",
  borderTopColor: C.goldDeep,
  animation: "peternaSpin 900ms linear infinite",
};

const loadingHeadline: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 26,
  lineHeight: 1.35,
  color: C.ink,
  textAlign: "center",
  maxWidth: 540,
};

const loadingHint: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 13,
  color: C.inkSofter,
  lineHeight: 1.6,
  textAlign: "center",
  maxWidth: 480,
};
