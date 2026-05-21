"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import {
  STORYBOARD_FRAME,
  STORYBOARD_REROLL_LOADING,
  substitutePetName,
} from "@/lib/library/copy";
import type {
  BeatWire,
  StoryboardFrameWire,
} from "@/lib/builder/wire-types";
import StoryboardFrameReview from "./StoryboardFrameReview";

// Single storyboard frame card.
//
// Default view (collapsed):
//   - Lazy-loaded image at the session aspect ratio.
//   - Scene label ("Scene N of M") + a one-line caption.
//   - "See details" toggle expands the caption inline.
//   - Tapping the image OR a "Looks good / Try this scene differently"
//     pill opens the mini-gate (StoryboardFrameReview) below the card.
//
// Rerolling state:
//   - The image swaps to a soft spinner panel labelled "Trying scene N
//     again…". Other cards stay visible.
//
// We deliberately don't show "Frame N" as a giant numeral on the rendered
// image — the page-numeral prohibition from the spec applies to rendered
// tribute frames. The card *label* in the editing UI is fine.

type Props = {
  beat: BeatWire;
  /** May be null briefly if the backend returns a partial set; render a
   *  preparing-state card so the grid doesn't collapse on missing data. */
  frame: StoryboardFrameWire | null;
  totalBeats: number;
  aspectRatio?: string | null;
  /** This card's frame is currently being rerolled — render the loading
   *  panel instead of the image. */
  isRerolling?: boolean;
  /** Disabled while another card is rerolling, or during approve. */
  disabled?: boolean;
  onReroll: (refinements: string[], notes: string | null) => void;
};

export default function StoryboardFrameCard({
  beat,
  frame,
  totalBeats,
  aspectRatio,
  isRerolling = false,
  disabled = false,
  onReroll,
}: Props) {
  // Local UI state for the mini-gate. Collapsed by default — the artifact
  // (image) gets full focus.
  const [showReview, setShowReview] = useState(false);
  const [showCaption, setShowCaption] = useState(false);

  // Close the review when a reroll succeeds (isRerolling flips false after
  // an in-flight period). We keep the panel closed unless the user
  // re-opens it deliberately.
  const sceneLabel = STORYBOARD_FRAME.scene_label_template
    .replace("[N]", String(beat.idx + 1))
    .replace("[M]", String(totalBeats));
  const cardAria = STORYBOARD_FRAME.card_aria_template
    .replace("[N]", String(beat.idx + 1))
    .replace("[M]", String(totalBeats));

  // CSS aspect-ratio string from the session aspect (defaults to 1:1).
  const aspectCss = (aspectRatio ?? "1:1").replace(":", " / ");

  return (
    <article aria-label={cardAria} style={cardWrap}>
      <FrameImage
        frame={frame}
        beat={beat}
        sceneLabel={sceneLabel}
        aspectCss={aspectCss}
        isRerolling={isRerolling}
        disabled={disabled}
        onTapImage={() => {
          if (disabled || isRerolling) return;
          setShowReview((v) => !v);
        }}
      />

      <header style={headerRow}>
        <span style={sceneLabelStyle}>{sceneLabel}</span>
        {/* Future hook: this row could host a per-card "regenerate" affordance,
            but right now the user opens the mini-gate via the image tap or
            the inline button below the caption. Keeping the header simple. */}
      </header>

      <CaptionBlock
        caption={beat.caption}
        expanded={showCaption}
        onToggle={() => setShowCaption((v) => !v)}
      />

      {showReview ? (
        <StoryboardFrameReview
          beat={beat}
          disabled={disabled}
          isRerolling={isRerolling}
          onReroll={(refinements, notes) => {
            onReroll(refinements, notes);
            // Keep the panel open until the reroll finishes; the parent
            // flips isRerolling and we can show the loading state inline.
          }}
          onKeep={() => setShowReview(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => !disabled && !isRerolling && setShowReview(true)}
          disabled={disabled || isRerolling}
          aria-expanded={false}
          aria-controls={`frame-${beat.idx}-review`}
          style={openReviewBtn(disabled || isRerolling)}
        >
          {STORYBOARD_FRAME.pills.reroll}
        </button>
      )}
    </article>
  );
}

// -----------------------------------------------------------------------------
// Frame image — lazy-loaded, fills the card aspect, tap-to-expand.
// Renders the per-frame reroll spinner when isRerolling.
// -----------------------------------------------------------------------------

function FrameImage({
  frame,
  beat,
  sceneLabel,
  aspectCss,
  isRerolling,
  disabled,
  onTapImage,
}: {
  frame: StoryboardFrameWire | null;
  beat: BeatWire;
  sceneLabel: string;
  aspectCss: string;
  isRerolling: boolean;
  disabled: boolean;
  onTapImage: () => void;
}) {
  const alt = `Storyboard frame for ${sceneLabel}: ${beat.caption || "scene"}`;

  if (isRerolling) {
    const line = STORYBOARD_REROLL_LOADING.drawing.replace(
      "[N]",
      String(beat.idx + 1),
    );
    return (
      <div
        role="status"
        aria-live="polite"
        style={{ ...frameBox, aspectRatio: aspectCss }}
      >
        <div style={loadingInnerStack}>
          <div aria-hidden="true" style={spinnerStyle} />
          <p style={rerollLoadingHeadline}>{line}</p>
          <p style={rerollLoadingHint}>
            {substitutePetName(STORYBOARD_REROLL_LOADING.drawing_hint, null)}
          </p>
        </div>
        <style>{`@keyframes peternaSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!frame) {
    return (
      <div style={{ ...frameBox, aspectRatio: aspectCss }}>
        <p style={preparingText}>Preparing scene {beat.idx + 1}…</p>
      </div>
    );
  }

  // Wrap the image in a button so it's keyboard-activatable. The user can
  // either tap the image OR the "Try this scene differently" button below.
  return (
    <button
      type="button"
      onClick={onTapImage}
      disabled={disabled}
      aria-label={`Open review for ${sceneLabel}`}
      style={{ ...frameBox, aspectRatio: aspectCss, padding: 0, cursor: disabled ? "not-allowed" : "zoom-in" }}
    >
      <Image
        src={frame.public_url}
        alt={alt}
        fill
        sizes="(max-width: 480px) 100vw, (max-width: 1080px) 50vw, 25vw"
        loading="lazy"
        style={{ objectFit: "cover" }}
        unoptimized
      />
    </button>
  );
}

// -----------------------------------------------------------------------------
// Caption block — one line by default, expand inline on tap.
// -----------------------------------------------------------------------------

function CaptionBlock({
  caption,
  expanded,
  onToggle,
}: {
  caption: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasCaption = caption.trim().length > 0;
  if (!hasCaption) {
    return <p style={captionEmpty}>(No caption.)</p>;
  }
  return (
    <div style={captionWrap}>
      <p style={expanded ? captionExpanded : captionCollapsed}>
        {caption}
      </p>
      <motion.button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        style={captionToggle}
      >
        {expanded
          ? STORYBOARD_FRAME.caption_collapse
          : STORYBOARD_FRAME.caption_expand}
      </motion.button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Styles — inline, tokens-only, matches the card rhythm from BeatCard.
// -----------------------------------------------------------------------------

const cardWrap: CSSProperties = {
  background: "#FFFBF3",
  border: `1px solid ${C.line}`,
  borderRadius: 18,
  padding: "14px 14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  width: "100%",
  // Keep the card's content vertically aligned in case the image area is
  // taller/shorter than its siblings (different aspect ratios mid-mount).
  alignSelf: "stretch",
};

const frameBox: CSSProperties = {
  width: "100%",
  position: "relative",
  borderRadius: 12,
  overflow: "hidden",
  background: "#FFFBF3",
  border: `1px solid ${C.line}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  // Reset native <button> styling when used as an image wrap.
  margin: 0,
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  paddingTop: 2,
};

const sceneLabelStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 16,
  lineHeight: 1.2,
  color: C.ink,
  fontWeight: 400,
  letterSpacing: "-0.005em",
};

const captionWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const captionCollapsed: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 15,
  lineHeight: 1.45,
  color: C.inkSoft,
  // One-line truncate by default — emotional grids want image-first.
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const captionExpanded: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 15,
  lineHeight: 1.45,
  color: C.inkSoft,
};

const captionEmpty: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 13,
  color: C.inkSofter,
  fontStyle: "italic",
};

const captionToggle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: C.inkSofter,
  fontFamily: FONT_SANS,
  fontSize: 12,
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
  textUnderlineOffset: 3,
  alignSelf: "flex-start",
};

const openReviewBtn = (disabled: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 14px",
  borderRadius: 999,
  fontFamily: FONT_SANS,
  fontSize: 12,
  fontWeight: 500,
  border: `1px solid ${C.line}`,
  background: "transparent",
  color: C.inkSoft,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  letterSpacing: "0.01em",
  marginTop: 2,
  alignSelf: "stretch",
});

const loadingInnerStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  padding: "16px",
  textAlign: "center",
};

const spinnerStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  border: "2px solid rgba(0,0,0,0.08)",
  borderTopColor: C.goldDeep,
  animation: "peternaSpin 900ms linear infinite",
};

const rerollLoadingHeadline: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 16,
  lineHeight: 1.35,
  color: C.ink,
};

const rerollLoadingHint: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: C.inkSofter,
  lineHeight: 1.5,
  maxWidth: 220,
};

const preparingText: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 13,
  color: C.inkSofter,
  fontStyle: "italic",
};
