"use client";

import { type CSSProperties } from "react";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import {
  STORYBOARD_LOADING,
  STORYBOARD_REVIEW,
  substitutePetName,
} from "@/lib/library/copy";
import type {
  BeatWire,
  StoryboardFrameWire,
} from "@/lib/builder/wire-types";
import GateReview, { type GateAction } from "./GateReview";
import StoryboardGrid from "./StoryboardGrid";

// Stage 5 — Storyboard view.
//
// Two modes:
//   - loading: "Drawing the storyboard for [PET_NAME]…" — fires while
//     /api/storyboard/render is in flight. The parent BuilderClient initiates
//     the POST; this view just shows the loading panel. Per spec the user
//     expects ~1 minute (N frames in parallel), so the hint copy says so.
//   - review: renders the N-frame grid wrapped in a GateReview. The gate's
//     pill row offers approval / start-over — the per-frame reroll lives
//     inside each StoryboardFrameCard.
//
// The grid is emotional — give it room. We don't squeeze captions, we don't
// add cost language, and we let the user reroll a single frame at a time.

export type StoryboardMode = "loading" | "review";

export type StoryboardAction = "approve" | "restart";

type Props = {
  petName: string | null;
  mode: StoryboardMode;
  /** The current frames (required in review mode). One per beat. */
  frames?: ReadonlyArray<StoryboardFrameWire>;
  /** The beats themselves — used for captions + scene labels on each card. */
  beats?: ReadonlyArray<BeatWire>;
  /** Session aspect ratio — drives the visible frame shape. */
  aspectRatio?: string | null;
  /** Which beat_idx is currently being rerolled (if any). */
  rerollBeatIdx?: number | null;
  /** Disable approve while a side-effect is in flight. */
  disabled?: boolean;
  /** Called when the user approves the full storyboard or starts over. */
  onAction: (action: StoryboardAction) => void;
  /** Called when the user submits a per-frame reroll from a card's mini-gate. */
  onRerollFrame: (beatIdx: number, refinements: string[], notes: string | null) => void;
};

export default function StoryboardView({
  petName,
  mode,
  frames,
  beats,
  aspectRatio,
  rerollBeatIdx = null,
  disabled = false,
  onAction,
  onRerollFrame,
}: Props) {
  if (mode === "loading" || !frames || !beats) {
    return <DrawingLoadingPanel petName={petName} />;
  }

  const headline = substitutePetName(STORYBOARD_REVIEW.headline, petName);
  const subhead = STORYBOARD_REVIEW.subhead;

  const actions: GateAction[] = [
    {
      id: "approve",
      label: STORYBOARD_REVIEW.pills.approve,
      variant: "primary",
    },
    {
      id: "restart",
      label: STORYBOARD_REVIEW.pills.restart,
      variant: "quiet",
    },
  ];

  return (
    <GateReview
      headline={headline}
      subhead={subhead}
      actions={actions}
      onAction={(id) => onAction(id as StoryboardAction)}
      pillsHint={STORYBOARD_REVIEW.pills_hint}
      disabled={disabled}
    >
      <div style={gridWrap}>
        <StoryboardGrid
          frames={frames}
          beats={beats}
          aspectRatio={aspectRatio}
          rerollBeatIdx={rerollBeatIdx}
          disabled={disabled}
          onRerollFrame={onRerollFrame}
        />
      </div>
    </GateReview>
  );
}

// -----------------------------------------------------------------------------
// Loading panel — "Drawing the storyboard for [PET_NAME]…"
// Pet name in the line is REQUIRED per spec.
// -----------------------------------------------------------------------------

function DrawingLoadingPanel({ petName }: { petName: string | null }) {
  const line = substitutePetName(STORYBOARD_LOADING.drawing, petName);
  return (
    <div role="status" aria-live="polite" style={loadingWrap}>
      <div aria-hidden="true" style={spinnerStyle} />
      <p style={loadingHeadline}>{line}</p>
      <p style={loadingHint}>{STORYBOARD_LOADING.drawing_hint}</p>
      <style>{`@keyframes peternaSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const gridWrap: CSSProperties = {
  width: "100%",
  // The storyboard grid wants more room than the narrow single-column wizard
  // body — bump the max-width so 4-up on desktop reads with breathing room.
  maxWidth: 1080,
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
  fontSize: 24,
  lineHeight: 1.4,
  color: C.ink,
  textAlign: "center",
};

const loadingHint: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 13,
  color: C.inkSofter,
  lineHeight: 1.55,
  textAlign: "center",
  maxWidth: 400,
};
