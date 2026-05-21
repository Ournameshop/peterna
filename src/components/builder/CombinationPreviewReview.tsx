"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import {
  COMBINATION_PREVIEW,
  substitutePetName,
} from "@/lib/library/copy";
import { DURATION, EASE, fadeIn } from "@/lib/builder/motion-tokens";
import GateReview, { type GateAction } from "./GateReview";

// Stage 3.5 — Combination Preview review (GATE 2).
//
// Body slot for <GateReview>. Renders ONE per-pet preview frame (the chosen
// format + theme + style applied to the locked character sheet) and the
// approval pills:
//
//   - "Looks beautiful"        → POST /api/preview/approve, advance to
//                                stage_3_complete.
//   - "Try a different style"  → step back to style_pick (preserves format +
//                                theme + character sheet).
//   - "Try a different theme"  → step back to theme_category_pick.
//   - "Start over"             → step back to curators_pick_or_manual.
//
// Loading state: the parent's render-on-mount has fired but no asset yet.
// Renders "Painting the first look at [PET_NAME]…" with a soft spinner.

export type PreviewReviewMode = "loading" | "review";

export type PreviewReviewAction =
  | "approve"
  | "restart_style"
  | "restart_theme"
  | "restart_all";

type Props = {
  petName: string | null;
  mode: PreviewReviewMode;
  /** Public URL of the rendered preview image (required in review mode). */
  imageUrl?: string;
  /** Substituted into the subhead — `[FORMAT_NAME] + [THEME_NAME] + [STYLE_NAME]`. */
  formatLabel?: string | null;
  themeLabel?: string | null;
  styleLabel?: string | null;
  /** Session aspect ratio — drives the preview frame shape. */
  aspectRatio?: string | null;
  disabled?: boolean;
  onAction: (action: PreviewReviewAction) => void;
};

export default function CombinationPreviewReview({
  petName,
  mode,
  imageUrl,
  formatLabel,
  themeLabel,
  styleLabel,
  aspectRatio,
  disabled = false,
  onAction,
}: Props) {
  if (mode === "loading" || !imageUrl) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="loading"
          variants={fadeIn()}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <PreviewLoadingPanel petName={petName} />
        </motion.div>
      </AnimatePresence>
    );
  }

  const headline = substitutePetName(COMBINATION_PREVIEW.headline, petName);

  // Compose the subhead from the format/theme/style labels — falls back to a
  // softer phrasing if any label is missing (e.g. backend hasn't returned yet
  // but we have an asset).
  const subhead = composeSubhead(formatLabel, themeLabel, styleLabel);

  const actions: GateAction[] = [
    {
      id: "approve",
      label: COMBINATION_PREVIEW.pills.approve,
      variant: "primary",
    },
    {
      id: "restart_style",
      label: COMBINATION_PREVIEW.pills.restart_style,
      variant: "danger",
    },
    {
      id: "restart_theme",
      label: COMBINATION_PREVIEW.pills.restart_theme,
      variant: "danger",
    },
    {
      id: "restart_all",
      label: COMBINATION_PREVIEW.pills.restart_all,
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
          onAction={(actionId) => onAction(actionId as PreviewReviewAction)}
          pillsHint={COMBINATION_PREVIEW.pills_hint}
          disabled={disabled}
          staggerPills
        >
          <PreviewFrame
            imageUrl={imageUrl}
            petName={petName}
            aspectRatio={aspectRatio}
          />
        </GateReview>
      </motion.div>
    </AnimatePresence>
  );
}

function composeSubhead(
  formatLabel: string | null | undefined,
  themeLabel: string | null | undefined,
  styleLabel: string | null | undefined,
): string | undefined {
  if (!formatLabel || !themeLabel || !styleLabel) return undefined;
  return COMBINATION_PREVIEW.subhead_template
    .replace("[FORMAT_NAME]", formatLabel)
    .replace("[THEME_NAME]", themeLabel)
    .replace("[STYLE_NAME]", styleLabel);
}

// -----------------------------------------------------------------------------
// Preview frame — responsive, lazy-loaded, drives the visible aspect ratio
// from the session's aspect_ratio so the user sees the actual master framing.
// -----------------------------------------------------------------------------

function PreviewFrame({
  imageUrl,
  petName,
  aspectRatio,
}: {
  imageUrl: string;
  petName: string | null;
  aspectRatio: string | null | undefined;
}) {
  const alt = substitutePetName(
    "Preview of [PET_NAME]'s tribute in the chosen format, theme, and art style",
    petName,
  );
  // Map "9:16" / "16:9" / "1:1" to CSS aspect-ratio. Default to 1:1 if unset.
  const css = (aspectRatio ?? "1:1").replace(":", " / ");

  return (
    <figure
      style={{
        width: "100%",
        maxWidth: 520,
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Reveal (Stage 3.5 — first look at the pet IN their world). Long
          ease-out scale+fade, then a single ~1.005 breath pulse. */}
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
        style={{
          width: "100%",
          aspectRatio: css,
          position: "relative",
          borderRadius: 18,
          overflow: "hidden",
          background: "#FFFBF3",
          border: `1px solid ${C.line}`,
          boxShadow: "0 2px 16px rgba(42, 33, 27, 0.08)",
        }}
      >
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 520px"
          loading="lazy"
          priority={false}
          style={{ objectFit: "contain" }}
          unoptimized
        />
      </motion.div>
    </figure>
  );
}

// -----------------------------------------------------------------------------
// Loading panel — "Painting the first look at [PET_NAME]…"
// -----------------------------------------------------------------------------

function PreviewLoadingPanel({ petName }: { petName: string | null }) {
  const line = substitutePetName(COMBINATION_PREVIEW.loading, petName);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: "64px 16px",
        minHeight: 320,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "2px solid rgba(0,0,0,0.08)",
          borderTopColor: C.goldDeep,
          animation: "peternaSpin 900ms linear infinite",
        }}
      />
      <p
        style={{
          margin: 0,
          fontFamily: FONT_DISPLAY,
          fontStyle: "italic",
          fontSize: 24,
          lineHeight: 1.4,
          color: C.ink,
          textAlign: "center",
        }}
      >
        {line}
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: FONT_SANS,
          fontSize: 13,
          color: C.inkSofter,
          lineHeight: 1.55,
          textAlign: "center",
          maxWidth: 360,
        }}
      >
        {COMBINATION_PREVIEW.loading_hint}
      </p>
      <style>{`@keyframes peternaSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
