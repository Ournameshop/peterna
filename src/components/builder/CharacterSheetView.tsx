"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import {
  CHARACTER_SHEET_LOADING,
  CHARACTER_SHEET_REVIEW,
  CHARACTER_SHEET_REFINEMENT,
  substitutePetName,
} from "@/lib/library/copy";
import { REFINEMENT_CHIPS } from "@/lib/builder/refinements";
import {
  DURATION,
  EASE,
  fadeIn,
} from "@/lib/builder/motion-tokens";
import GateReview, { type GateAction } from "./GateReview";

// Stage 2 — Character Sheet view.
//
// Body slot for <GateReview>. Renders:
//   - The 4-view 2K character sheet image, responsively constrained.
//   - A row of approval pills via GateReview: Looks great / Needs tweaks /
//     Start over.
//   - When "Needs tweaks" is tapped, expands a refinement chip group +
//     free-text textarea below the gate. Submitting the panel re-renders
//     with the corrections embedded.
//   - Loading state — "Drawing [PET_NAME]…" with a soft spinner. No vendor
//     names, no cost, no countdown.

export type CharacterSheetMode = "loading" | "review";

type Props = {
  petName: string | null;
  mode: CharacterSheetMode;
  /** Public URL of the rendered character sheet (required in review mode). */
  imageUrl?: string;
  /** Refinements pre-selected on entry (for a re-render that comes back). */
  initialRefinements?: ReadonlyArray<string>;
  initialNotes?: string | null;
  /** Action handlers. The page wires these to fetch + state transitions. */
  onApprove: () => void;
  onRequestRefinement: (refinements: string[], notes: string | null) => void;
  onRestart: () => void;
  /** Disable approve/start-over while a PATCH or render is in flight. */
  disabled?: boolean;
};

export default function CharacterSheetView({
  petName,
  mode,
  imageUrl,
  initialRefinements = [],
  initialNotes = null,
  onApprove,
  onRequestRefinement,
  onRestart,
  disabled = false,
}: Props) {
  // Local UI state for the refinement sub-panel. It's a sub-view of the gate
  // (slides in below the pill row) rather than a separate stage, so the user
  // never loses sight of the artifact they're correcting.
  const [showRefinement, setShowRefinement] = useState<boolean>(
    initialRefinements.length > 0 || (initialNotes ?? "").length > 0,
  );
  const [picked, setPicked] = useState<string[]>([...initialRefinements]);
  const [notes, setNotes] = useState<string>(initialNotes ?? "");

  // We always render the AnimatePresence wrapper so the loading→review
  // transition can choreograph (spinner fade out → sheet reveal in).
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
          <DrawingLoadingPanel petName={petName} />
        </motion.div>
      </AnimatePresence>
    );
  }

  const headline = substitutePetName(CHARACTER_SHEET_REVIEW.headline, petName);
  const subhead = CHARACTER_SHEET_REVIEW.subhead;

  const actions: GateAction[] = [
    {
      id: "approve",
      label: CHARACTER_SHEET_REVIEW.pills.approve,
      variant: "primary",
    },
    {
      id: "refine",
      label: CHARACTER_SHEET_REVIEW.pills.refine,
      variant: "danger",
    },
    {
      id: "restart",
      label: CHARACTER_SHEET_REVIEW.pills.restart,
      variant: "quiet",
    },
  ];

  function handleAction(actionId: string) {
    if (actionId === "approve") {
      onApprove();
      return;
    }
    if (actionId === "restart") {
      // Start over re-renders from scratch (no refinements). The reducer
      // clears pending refinements so the next render fires fresh.
      onRestart();
      return;
    }
    if (actionId === "refine") {
      setShowRefinement(true);
    }
  }

  function togglePick(id: string) {
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id],
    );
  }

  function submitRefinement() {
    onRequestRefinement(picked, notes.trim().length > 0 ? notes.trim() : null);
  }

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
          onAction={handleAction}
          pillsHint={CHARACTER_SHEET_REVIEW.pills_hint}
          disabled={disabled}
          staggerPills
          extraBody={
            showRefinement ? (
              <RefinementPanel
                petName={petName}
                picked={picked}
                notes={notes}
                disabled={disabled}
                onTogglePick={togglePick}
                onNotesChange={setNotes}
                onSubmit={submitRefinement}
                onCancel={() => {
                  setShowRefinement(false);
                  setPicked([]);
                  setNotes("");
                }}
              />
            ) : null
          }
        >
          <CharacterSheetImage imageUrl={imageUrl} petName={petName} />
        </GateReview>
      </motion.div>
    </AnimatePresence>
  );
}

// -----------------------------------------------------------------------------
// Character sheet image — responsive, lazy-loaded, capped to maintain aspect.
// -----------------------------------------------------------------------------

function CharacterSheetImage({
  imageUrl,
  petName,
}: {
  imageUrl: string;
  petName: string | null;
}) {
  const alt = substitutePetName(
    "Four-view character sheet of [PET_NAME]",
    petName,
  );

  return (
    <figure
      style={{
        width: "100%",
        maxWidth: 640,
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Reveal: long ease-out scale+fade, then a single ~1.005 breath
          pulse so the artifact feels like it settles rather than holds
          stiff. We bake both into one animate keyframe sequence:
          opacity 0→1 + scale 0.97 → 1 → 1.005 → 1. */}
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
          aspectRatio: "1 / 1",
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
          sizes="(max-width: 768px) 100vw, 640px"
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
// Loading panel — "Drawing [PET_NAME]…" with a soft spinner.
// Pet name in the line is REQUIRED per spec.
// -----------------------------------------------------------------------------

function DrawingLoadingPanel({ petName }: { petName: string | null }) {
  const line = substitutePetName(CHARACTER_SHEET_LOADING.drawing, petName);
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
        {CHARACTER_SHEET_LOADING.drawing_hint}
      </p>
      <style>{`@keyframes peternaSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Refinement panel — chip group + textarea + submit/cancel.
// Slides in below the gate when the user picks "Needs tweaks."
// -----------------------------------------------------------------------------

function RefinementPanel({
  petName,
  picked,
  notes,
  disabled,
  onTogglePick,
  onNotesChange,
  onSubmit,
  onCancel,
}: {
  petName: string | null;
  picked: string[];
  notes: string;
  disabled: boolean;
  onTogglePick: (id: string) => void;
  onNotesChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const canSubmit =
    !disabled && (picked.length > 0 || notes.trim().length > 0);
  const submitLabel = substitutePetName(
    CHARACTER_SHEET_REFINEMENT.submit,
    petName,
  );

  const chipBase: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 999,
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    background: C.cream,
    color: C.ink,
    border: `1px solid ${C.line}`,
    letterSpacing: "0.01em",
    textAlign: "left",
  };

  return (
    <section
      aria-label="What should we adjust"
      style={{
        marginTop: 18,
        padding: "24px 22px",
        background: "#FFFBF3",
        border: `1px solid ${C.line}`,
        borderRadius: 18,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: FONT_SANS,
            fontSize: 17,
            fontWeight: 500,
            color: C.ink,
            lineHeight: 1.4,
          }}
        >
          {CHARACTER_SHEET_REFINEMENT.headline}
        </h3>
        <p
          style={{
            margin: 0,
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: C.inkSofter,
            lineHeight: 1.55,
          }}
        >
          {CHARACTER_SHEET_REFINEMENT.subhead}
        </p>
      </header>

      <div
        role="group"
        aria-label="Refinement chips"
        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
      >
        {REFINEMENT_CHIPS.map((chip) => {
          const isSel = picked.includes(chip.id);
          const style: CSSProperties = {
            ...chipBase,
            background: isSel ? C.ink : C.cream,
            color: isSel ? C.cream : C.ink,
            borderColor: isSel ? C.ink : C.line,
          };
          return (
            <motion.button
              key={chip.id}
              type="button"
              onClick={() => !disabled && onTogglePick(chip.id)}
              whileHover={!disabled ? { scale: 1.02 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              role="checkbox"
              aria-checked={isSel}
              style={style}
            >
              {chip.label}
              {isSel ? <Check size={12} /> : null}
            </motion.button>
          );
        })}
      </div>

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontFamily: FONT_SANS,
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: C.inkSoft,
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}
        >
          {CHARACTER_SHEET_REFINEMENT.notes_label}
        </span>
        <textarea
          rows={3}
          value={notes}
          maxLength={500}
          disabled={disabled}
          placeholder={CHARACTER_SHEET_REFINEMENT.notes_placeholder}
          onChange={(e) => onNotesChange(e.target.value)}
          style={{
            fontFamily: FONT_SANS,
            fontSize: 14,
            lineHeight: 1.55,
            color: C.ink,
            background: C.cream,
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            padding: "12px 14px",
            outline: "none",
            resize: "vertical",
            minHeight: 80,
          }}
        />
      </label>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 4,
        }}
      >
        <motion.button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          whileHover={canSubmit ? { scale: 1.02 } : {}}
          whileTap={canSubmit ? { scale: 0.98 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "12px 24px",
            borderRadius: 999,
            fontFamily: FONT_SANS,
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            cursor: canSubmit ? "pointer" : "not-allowed",
            background: canSubmit ? C.ink : C.line,
            color: canSubmit ? C.cream : C.inkSofter,
          }}
        >
          {submitLabel}
        </motion.button>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          style={{
            background: "transparent",
            border: "none",
            color: C.inkSofter,
            fontFamily: FONT_SANS,
            fontSize: 13,
            cursor: disabled ? "not-allowed" : "pointer",
            padding: "12px 16px",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          {CHARACTER_SHEET_REFINEMENT.cancel}
        </button>
      </div>
    </section>
  );
}
