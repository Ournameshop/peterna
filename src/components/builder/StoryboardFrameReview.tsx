"use client";

import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { C, FONT_SANS } from "@/lib/peterna-tokens";
import { STORYBOARD_FRAME } from "@/lib/library/copy";
import { REFINEMENT_CHIPS } from "@/lib/builder/refinements";
import type { BeatWire } from "@/lib/builder/wire-types";

// Per-frame mini-gate.
//
// Slides in below a StoryboardFrameCard when the user taps the image or the
// "Try this scene differently" button. Layout mirrors the character-sheet
// refinement panel from CharacterSheetView — chip group + free-text
// textarea + submit/cancel — so the user gets a consistent correction
// affordance across the wizard.
//
// Reuses the same REFINEMENT_CHIPS set as the character sheet: the chip IDs
// carry over to the storyboard prompt builder (backend resolves IDs to
// imperative instructions). Per-frame reroll uses the same shape as
// `StoryboardRerollRequest.refinements`.
//
// IMPORTANT: no cost language. Submit copy is "Try this scene again," cancel
// is "Never mind — keep this one." Reroll is gentle, not transactional.

type Props = {
  beat: BeatWire;
  /** Disabled while a reroll is in flight anywhere in the grid. */
  disabled?: boolean;
  /** This card's reroll is currently in flight — submit stays disabled. */
  isRerolling?: boolean;
  onReroll: (refinements: string[], notes: string | null) => void;
  /** Close the panel without submitting ("Looks good, keep this one"). */
  onKeep: () => void;
};

export default function StoryboardFrameReview({
  beat,
  disabled = false,
  isRerolling = false,
  onReroll,
  onKeep,
}: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>("");

  function togglePick(id: string) {
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id],
    );
  }

  function submit() {
    onReroll(picked, notes.trim().length > 0 ? notes.trim() : null);
  }

  const canSubmit =
    !disabled &&
    !isRerolling &&
    (picked.length > 0 || notes.trim().length > 0);

  const chipBase: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 999,
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: 500,
    cursor: disabled || isRerolling ? "not-allowed" : "pointer",
    background: C.cream,
    color: C.ink,
    border: `1px solid ${C.line}`,
    letterSpacing: "0.01em",
    textAlign: "left",
  };

  return (
    <section
      id={`frame-${beat.idx}-review`}
      aria-label={STORYBOARD_FRAME.refine_headline}
      style={panelWrap}
    >
      <header style={headerStack}>
        <h3 style={headlineStyle}>{STORYBOARD_FRAME.refine_headline}</h3>
        <p style={subheadStyle}>{STORYBOARD_FRAME.refine_subhead}</p>
      </header>

      <div
        role="group"
        aria-label="What to adjust"
        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
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
              onClick={() =>
                !(disabled || isRerolling) && togglePick(chip.id)
              }
              whileHover={
                !(disabled || isRerolling) ? { scale: 1.02 } : {}
              }
              whileTap={
                !(disabled || isRerolling) ? { scale: 0.98 } : {}
              }
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              role="checkbox"
              aria-checked={isSel}
              style={style}
            >
              {chip.label}
              {isSel ? <Check size={11} /> : null}
            </motion.button>
          );
        })}
      </div>

      <label style={labelStack}>
        <span style={labelText}>{STORYBOARD_FRAME.refine_notes_label}</span>
        <textarea
          rows={2}
          value={notes}
          maxLength={500}
          disabled={disabled || isRerolling}
          placeholder={STORYBOARD_FRAME.refine_notes_placeholder}
          onChange={(e) => setNotes(e.target.value)}
          style={textareaStyle}
        />
      </label>

      <div style={actionRow}>
        <motion.button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          whileHover={canSubmit ? { scale: 1.02 } : {}}
          whileTap={canSubmit ? { scale: 0.98 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={{
            ...submitButtonBase,
            background: canSubmit ? C.ink : C.line,
            color: canSubmit ? C.cream : C.inkSofter,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {STORYBOARD_FRAME.refine_submit}
        </motion.button>
        <button
          type="button"
          onClick={onKeep}
          disabled={disabled || isRerolling}
          style={cancelButton(disabled || isRerolling)}
        >
          {STORYBOARD_FRAME.refine_cancel}
        </button>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const panelWrap: CSSProperties = {
  marginTop: 4,
  padding: "14px 14px",
  background: C.cream,
  border: `1px solid ${C.line}`,
  borderRadius: 14,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const headerStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const headlineStyle: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 14,
  fontWeight: 600,
  color: C.ink,
  lineHeight: 1.4,
};

const subheadStyle: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: C.inkSofter,
  lineHeight: 1.5,
};

const labelStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontFamily: FONT_SANS,
};

const labelText: CSSProperties = {
  fontSize: 11,
  color: C.inkSoft,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const textareaStyle: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 13,
  lineHeight: 1.5,
  color: C.ink,
  background: "#FFFBF3",
  border: `1px solid ${C.line}`,
  borderRadius: 10,
  padding: "8px 10px",
  outline: "none",
  resize: "vertical",
  width: "100%",
  boxSizing: "border-box",
};

const actionRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 2,
  alignItems: "center",
};

const submitButtonBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "9px 16px",
  borderRadius: 999,
  fontFamily: FONT_SANS,
  fontSize: 13,
  fontWeight: 500,
  border: "none",
};

const cancelButton = (disabled: boolean): CSSProperties => ({
  background: "transparent",
  border: "none",
  color: C.inkSofter,
  fontFamily: FONT_SANS,
  fontSize: 12,
  cursor: disabled ? "not-allowed" : "pointer",
  padding: "9px 10px",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  opacity: disabled ? 0.5 : 1,
});
