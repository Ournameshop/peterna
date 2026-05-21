"use client";

import { type CSSProperties } from "react";
import { motion } from "framer-motion";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { CINEMATOGRAPHY, substitutePetName } from "@/lib/library/copy";
import { DP_STYLE_OVERLAYS } from "@/lib/library/dp-styles";
import type {
  BeatWire,
  DpStyleOverlayId,
  MotionBriefWire,
} from "@/lib/builder/wire-types";
import GateReview, { type GateAction } from "./GateReview";
import PillPicker, { type Pill } from "./PillPicker";
import CinematographyTable, {
  type CinematographyFieldName,
} from "./CinematographyTable";

// Stage 5.7 body slot for <WizardShell>.
//
// Modes:
//   - "picker"   (stage = cinematography_brief): the DP overlay picker. Six
//     pills (5 DPs + "No specific style"). On submit we POST
//     /api/cinematography/derive with the picked overlay.
//   - "loading"  (stage = cinematography_render): derive in flight. Loading
//     copy uses the pet's name per spec.
//   - "review"   (stage = cinematography_review): the brief table inside a
//     GateReview ("Looks great" / "Reapply derivation" / "Start over").
//
// The CinematographyView is a thin orchestrator — it owns no network state,
// just the picker's local selection. The BuilderClient fires every side-effect.

export type CinematographyMode = "picker" | "loading" | "review";

export type CinematographyAction = "approve" | "regenerate" | "restart";

type Props = {
  petName: string | null;
  mode: CinematographyMode;
  /** Pre-selected overlay (sticky between re-entries). */
  defaultOverlay?: DpStyleOverlayId | null;
  /** Briefs to display in review mode. */
  briefs?: ReadonlyArray<MotionBriefWire>;
  /** Beat sheet (for archetype labels in the table). */
  beats?: ReadonlyArray<BeatWire> | null;
  /** Disable interactive controls while a side-effect is in flight. */
  disabled?: boolean;
  /** Called when the user submits the DP overlay picker. */
  onApplyOverlay: (overlay: DpStyleOverlayId) => void;
  /** Called when the user edits a single field on a single brief. */
  onFieldChange: (
    beatIdx: number,
    field: CinematographyFieldName,
    next: string,
  ) => void;
  /** Called when the user picks one of the review-mode actions. */
  onReviewAction: (action: CinematographyAction) => void;
};

export default function CinematographyView({
  petName,
  mode,
  defaultOverlay,
  briefs,
  beats,
  disabled = false,
  onApplyOverlay,
  onFieldChange,
  onReviewAction,
}: Props) {
  if (mode === "loading") {
    return <ComposingLoadingPanel petName={petName} />;
  }
  if (mode === "review") {
    return (
      <ReviewBody
        petName={petName}
        briefs={briefs ?? []}
        beats={beats ?? null}
        disabled={disabled}
        onFieldChange={onFieldChange}
        onReviewAction={onReviewAction}
      />
    );
  }
  return (
    <PickerBody
      petName={petName}
      defaultOverlay={defaultOverlay ?? "none"}
      disabled={disabled}
      onApplyOverlay={onApplyOverlay}
    />
  );
}

// -----------------------------------------------------------------------------
// Picker (cinematography_brief)
// -----------------------------------------------------------------------------

function PickerBody({
  petName,
  defaultOverlay,
  disabled,
  onApplyOverlay,
}: {
  petName: string | null;
  defaultOverlay: DpStyleOverlayId;
  disabled: boolean;
  onApplyOverlay: (overlay: DpStyleOverlayId) => void;
}) {
  const pills: Pill[] = DP_STYLE_OVERLAYS.map((d) => ({
    id: d.id,
    label: d.label,
    description: d.secondary,
  }));

  const headline = substitutePetName(CINEMATOGRAPHY.picker.headline, petName);

  return (
    <section
      aria-label="Stage 5.7 — Cinematography brief"
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      <header style={pickerHeader}>
        <h2 style={pickerHeadline}>{headline}</h2>
        <p style={pickerSubhead}>{CINEMATOGRAPHY.picker.subhead}</p>
      </header>

      <PillPicker
        pills={pills}
        variant="rich"
        defaultSelected={[defaultOverlay]}
        question={undefined}
        hint={CINEMATOGRAPHY.picker.pick_hint}
        submitting={disabled}
        submitLabel={CINEMATOGRAPHY.picker.submit}
        onSubmit={(ids) => {
          const pick = (ids[0] ?? "none") as DpStyleOverlayId;
          onApplyOverlay(pick);
        }}
      />
    </section>
  );
}

// -----------------------------------------------------------------------------
// Review (cinematography_review)
// -----------------------------------------------------------------------------

function ReviewBody({
  petName,
  briefs,
  beats,
  disabled,
  onFieldChange,
  onReviewAction,
}: {
  petName: string | null;
  briefs: ReadonlyArray<MotionBriefWire>;
  beats: ReadonlyArray<BeatWire> | null;
  disabled: boolean;
  onFieldChange: (
    beatIdx: number,
    field: CinematographyFieldName,
    next: string,
  ) => void;
  onReviewAction: (action: CinematographyAction) => void;
}) {
  const headline = substitutePetName(CINEMATOGRAPHY.review.headline, petName);

  const actions: GateAction[] = [
    {
      id: "approve",
      label: CINEMATOGRAPHY.review.pills.approve,
      variant: "primary",
    },
    {
      id: "regenerate",
      label: CINEMATOGRAPHY.review.pills.regenerate,
      variant: "danger",
    },
    {
      id: "restart",
      label: CINEMATOGRAPHY.review.pills.restart,
      variant: "quiet",
    },
  ];

  return (
    <GateReview
      headline={headline}
      subhead={CINEMATOGRAPHY.review.subhead}
      actions={actions}
      onAction={(id) => onReviewAction(id as CinematographyAction)}
      pillsHint={CINEMATOGRAPHY.review.pills_hint}
      disabled={disabled}
      ariaLabel="Stage 5.7 — Cinematography review"
    >
      <div style={tableWrap}>
        <CinematographyTable
          briefs={briefs}
          beats={beats}
          disabled={disabled}
          onFieldChange={onFieldChange}
        />
      </div>
    </GateReview>
  );
}

// -----------------------------------------------------------------------------
// Loading panel — "Composing the cinematography for [PET_NAME]…"
// -----------------------------------------------------------------------------

function ComposingLoadingPanel({ petName }: { petName: string | null }) {
  const line = substitutePetName(CINEMATOGRAPHY.loading, petName);
  return (
    <div role="status" aria-live="polite" style={loadingWrap}>
      <motion.div
        aria-hidden="true"
        style={spinnerStyle}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
      />
      <p style={loadingHeadline}>{line}</p>
      <p style={loadingHint}>{CINEMATOGRAPHY.loading_hint}</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const pickerHeader: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  textAlign: "center",
};

const pickerHeadline: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 30,
  lineHeight: 1.3,
  color: C.ink,
  fontWeight: 400,
  letterSpacing: "-0.005em",
};

const pickerSubhead: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 14,
  color: C.inkSofter,
  lineHeight: 1.55,
  maxWidth: 560,
  marginLeft: "auto",
  marginRight: "auto",
};

const tableWrap: CSSProperties = {
  width: "100%",
  maxWidth: 920,
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
};

const loadingHeadline: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 24,
  lineHeight: 1.4,
  color: C.ink,
  textAlign: "center",
  maxWidth: 480,
};

const loadingHint: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 13,
  color: C.inkSofter,
  lineHeight: 1.55,
  textAlign: "center",
  maxWidth: 380,
};
