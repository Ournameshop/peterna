"use client";

import { type CSSProperties } from "react";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import {
  BEAT_SHEET_LOADING,
  BEAT_SHEET_REVIEW,
  substitutePetName,
} from "@/lib/library/copy";
import type { BeatWire } from "@/lib/builder/wire-types";
import GateReview, { type GateAction } from "./GateReview";
import BeatList from "./BeatList";

// Stage 4 — Beat Sheet body slot for <WizardShell>.
//
// Two modes:
//   - loading: "Drafting the story of [PET_NAME]…" — fires while the generate
//     route is in flight. The parent BuilderClient initiates the POST; this
//     view just shows the loading panel.
//   - review: renders the N-beat list inside a GateReview. The pill row offers
//       - "Approve and continue"        → POST /api/beat-sheet/approve
//       - "Rewrite the whole sheet"     → re-fire generate with fresh idempotency key
//       - "Start over"                  → bounce back to stage_3_complete
//                                         (the user re-picks format/theme/style)
//
// Per spec rule: "Beat N of M" labels in the editing UI are author-facing
// and allowed. The page-numeral prohibition only applies to the RENDERED
// tribute frames.

export type BeatSheetMode = "loading" | "review";

export type BeatSheetAction = "approve" | "regenerate" | "restart";

type Props = {
  petName: string | null;
  mode: BeatSheetMode;
  /** The current beat array (required in review mode). */
  beats?: ReadonlyArray<BeatWire>;
  /** Disable approve/regenerate while a side-effect is in flight. */
  disabled?: boolean;
  /** Called whenever a single beat is edited inline. The parent debounces a
   *  PATCH /api/beat-sheet upstream. */
  onBeatsChange: (next: BeatWire[]) => void;
  /** Called when the user picks an approval / regenerate / restart action. */
  onAction: (action: BeatSheetAction) => void;
};

export default function BeatSheetView({
  petName,
  mode,
  beats,
  disabled = false,
  onBeatsChange,
  onAction,
}: Props) {
  if (mode === "loading" || !beats) {
    return <DraftingLoadingPanel petName={petName} />;
  }

  const headline = substitutePetName(BEAT_SHEET_REVIEW.headline, petName);
  const subhead = BEAT_SHEET_REVIEW.subhead;

  const actions: GateAction[] = [
    {
      id: "approve",
      label: BEAT_SHEET_REVIEW.pills.approve,
      variant: "affirm",
    },
    {
      id: "regenerate",
      label: BEAT_SHEET_REVIEW.pills.regenerate,
      variant: "danger",
    },
    {
      id: "restart",
      label: BEAT_SHEET_REVIEW.pills.restart,
      variant: "quiet",
    },
  ];

  return (
    <GateReview
      headline={headline}
      subhead={subhead}
      actions={actions}
      onAction={(id) => onAction(id as BeatSheetAction)}
      pillsHint={BEAT_SHEET_REVIEW.pills_hint}
      disabled={disabled}
    >
      {/* The artifact slot — the editable beat list. We constrain the width
          so the cards align with the rest of the wizard's narrow column. */}
      <div style={listWrap}>
        <BeatList
          beats={beats}
          disabled={disabled}
          onChange={onBeatsChange}
        />
      </div>
    </GateReview>
  );
}

// -----------------------------------------------------------------------------
// Loading panel — "Drafting the story of [PET_NAME]…"
// Pet name in the line is REQUIRED per spec.
// -----------------------------------------------------------------------------

function DraftingLoadingPanel({ petName }: { petName: string | null }) {
  const line = substitutePetName(BEAT_SHEET_LOADING.drafting, petName);
  return (
    <div
      role="status"
      aria-live="polite"
      style={loadingWrap}
    >
      <div aria-hidden="true" style={spinnerStyle} />
      <p style={loadingHeadline}>{line}</p>
      <p style={loadingHint}>{BEAT_SHEET_LOADING.drafting_hint}</p>
      <style>{`@keyframes peternaSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const listWrap: CSSProperties = {
  width: "100%",
  maxWidth: 640,
};

const loadingWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 18,
  padding: "64px 16px",
  minHeight: 320,
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
  maxWidth: 360,
};
