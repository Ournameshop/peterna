"use client";

import { type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { ASSEMBLY, substitutePetName } from "@/lib/library/copy";
import { DURATION, EASE, fadeIn } from "@/lib/builder/motion-tokens";
import GateReview, { type GateAction } from "./GateReview";

// Stage 7 — Assembly.
//
// Two modes:
//   - loading: "Stitching [PET_NAME]'s tribute together…" while
//     POST /api/assembly/render is in flight. The render is slow — title
//     cards compositing, music laying down, narration ducking — so we set
//     long-render expectations in the hint.
//   - review: the final MP4 with native <video> controls inside a GateReview
//     gate. Pills are "It's beautiful" (approve), "Re-stitch with changes"
//     (bounce back to The Words / cinematography), "Re-render specific clips"
//     (bounce back to Stage 6 for selective rerolls).
//
// No vendor names; no "ffmpeg" — we say "stitching," "finishing," "the final
// cut." A failed assembly is not modeled at this layer — the BuilderClient
// owns the retry decision and feeds us a fresh `mode="loading"` until it
// succeeds.

export type AssemblyMode = "loading" | "review";
export type AssemblyAction = "approve" | "restitch" | "reroll_clips";

type Props = {
  petName: string | null;
  mode: AssemblyMode;
  /** Final MP4 public URL (required in review mode). */
  videoUrl?: string | null;
  /** Session aspect ratio — drives the video frame's max-width to keep the
   *  poster sensibly sized on desktop without letterboxing the player. */
  aspectRatio?: string | null;
  /** Disable approve while a side-effect is in flight. */
  disabled?: boolean;
  /** Called with the picked gate action ("approve" / "restitch" / "reroll_clips"). */
  onAction: (action: AssemblyAction) => void;
};

export default function AssemblyView({
  petName,
  mode,
  videoUrl,
  aspectRatio,
  disabled = false,
  onAction,
}: Props) {
  if (mode === "loading" || !videoUrl) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="loading"
          variants={fadeIn()}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <StitchingLoadingPanel petName={petName} />
        </motion.div>
      </AnimatePresence>
    );
  }

  const headline = substitutePetName(ASSEMBLY.review.headline, petName);
  const subhead = ASSEMBLY.review.subhead;

  const actions: GateAction[] = [
    {
      id: "approve",
      label: ASSEMBLY.review.pills.approve,
      variant: "affirm",
    },
    {
      id: "restitch",
      label: ASSEMBLY.review.pills.restitch,
      variant: "quiet",
    },
    {
      id: "reroll_clips",
      label: ASSEMBLY.review.pills.reroll_clips,
      variant: "quiet",
    },
  ];

  // Width clamp by aspect — 9:16 caps narrower than 16:9 so the player isn't
  // a 1080-wide letterboxed monster on desktop. The browser handles the
  // native aspect from the file; we only constrain the outer width.
  const playerMaxWidth = clampMaxWidth(aspectRatio);

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
          onAction={(id) => onAction(id as AssemblyAction)}
          pillsHint={ASSEMBLY.review.pills_hint}
          disabled={disabled}
          ariaLabel="Final tribute review"
          staggerPills
        >
          {/* The final cut — reveal with the long ease-out + breath pulse so
              the user feels the artifact settle. */}
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
            style={{ ...playerWrap, maxWidth: playerMaxWidth }}
          >
            <video
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              // The browser owns the native poster — no thumbnail prop because the
              // first frame is usually the title card and that's exactly what we
              // want as the static frame.
              style={videoStyle}
              aria-label={`Final tribute video for ${petName ?? "your pet"}`}
            />
          </motion.div>
        </GateReview>
      </motion.div>
    </AnimatePresence>
  );
}

// -----------------------------------------------------------------------------
// Loading panel — "Stitching [PET_NAME]'s tribute together…"
// -----------------------------------------------------------------------------

function StitchingLoadingPanel({ petName }: { petName: string | null }) {
  const line = substitutePetName(ASSEMBLY.loading, petName);
  return (
    <div role="status" aria-live="polite" style={loadingWrap}>
      <div aria-hidden="true" style={spinnerStyle} />
      <p style={loadingHeadline}>{line}</p>
      <p style={loadingHint}>{ASSEMBLY.loading_hint}</p>
      <style>{`@keyframes peternaSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function clampMaxWidth(aspectRatio: string | null | undefined): number {
  // 9:16 — vertical phone — keep the player tight so it doesn't dominate the
  // page on desktop. 1:1 — square — slightly wider. 16:9 — landscape — full
  // width up to the wizard's natural max.
  if (aspectRatio === "9:16") return 420;
  if (aspectRatio === "1:1") return 560;
  return 880;
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const playerWrap: CSSProperties = {
  width: "100%",
  margin: "0 auto",
  borderRadius: 14,
  overflow: "hidden",
  background: "#0F0E0C",
  border: `1px solid ${C.line}`,
};

const videoStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
  background: "#0F0E0C",
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
