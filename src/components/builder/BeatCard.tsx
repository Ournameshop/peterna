"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import {
  BEAT_ARCHETYPE_LABELS,
  BEAT_SHEET_CAPTION_WARNING,
  BEAT_SHEET_REVIEW,
} from "@/lib/library/copy";
import type { BeatWire } from "@/lib/builder/wire-types";
import {
  CAPTION_WORD_LIMIT,
  validateBeat,
} from "@/lib/builder/caption-validate";

// Single beat — a card in the BeatList. Renders the author-facing label
// ("Beat 3 of 12"), the archetype pill, the caption field and the scene
// description. Default collapsed view shows caption + one line of scene
// description; tapping Edit expands the textarea editor.
//
// Edits surface to the parent via a single `onChange(updated)` callback. The
// parent BeatList owns the array; this card is a pure controlled component.
//
// Per spec rule, "Beat N of M" labels here are author-facing scene labels —
// they're allowed (the page-numeral prohibition applies to the RENDERED
// tribute itself, not to the editing UI).

type Props = {
  beat: BeatWire;
  totalBeats: number;
  disabled?: boolean;
  onChange: (next: BeatWire) => void;
};

export default function BeatCard({
  beat,
  totalBeats,
  disabled = false,
  onChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const captionRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus the caption when entering edit mode so the user lands directly on
  // the field they're most likely to want to fix.
  useEffect(() => {
    if (editing && captionRef.current) {
      captionRef.current.focus();
      // Place cursor at end (default browser behavior is start on programmatic focus).
      const len = captionRef.current.value.length;
      captionRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const beatLabel = BEAT_SHEET_REVIEW.beat_label_template
    .replace("[N]", String(beat.idx + 1))
    .replace("[M]", String(totalBeats));

  const archetypeLabel =
    BEAT_ARCHETYPE_LABELS[beat.archetype.toLowerCase()] ??
    beat.archetype.toUpperCase();

  const { caption_word_count, caption_too_long } = validateBeat(beat);

  const handleCaptionChange = (value: string) => {
    onChange({ ...beat, caption: value });
  };
  const handleSceneChange = (value: string) => {
    onChange({ ...beat, scene_description: value });
  };

  return (
    <article
      aria-label={`${beatLabel} — ${archetypeLabel}`}
      style={cardWrap}
    >
      <header style={headerRow}>
        <div style={labelStack}>
          <span style={beatLabelStyle}>{beatLabel}</span>
          <span style={archetypeStyle}>{archetypeLabel}</span>
        </div>
        <motion.button
          type="button"
          onClick={() => !disabled && setEditing((e) => !e)}
          disabled={disabled}
          whileHover={!disabled ? { scale: 1.03 } : {}}
          whileTap={!disabled ? { scale: 0.97 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          aria-expanded={editing}
          aria-controls={`beat-${beat.idx}-editor`}
          style={editButton(disabled)}
        >
          {editing ? BEAT_SHEET_REVIEW.done_button : BEAT_SHEET_REVIEW.edit_button}
        </motion.button>
      </header>

      {editing ? (
        <div id={`beat-${beat.idx}-editor`} style={editorStack}>
          <label style={fieldLabelStack}>
            <span style={fieldLabelText}>{BEAT_SHEET_REVIEW.caption_label}</span>
            <textarea
              ref={captionRef}
              rows={2}
              value={beat.caption}
              maxLength={240}
              disabled={disabled}
              onChange={(e) => handleCaptionChange(e.target.value)}
              style={textareaStyle}
              aria-describedby={`beat-${beat.idx}-caption-helper`}
            />
            <CaptionCounter
              id={`beat-${beat.idx}-caption-helper`}
              wordCount={caption_word_count}
              tooLong={Boolean(caption_too_long)}
            />
          </label>

          <label style={fieldLabelStack}>
            <span style={fieldLabelText}>{BEAT_SHEET_REVIEW.scene_label}</span>
            <textarea
              rows={4}
              value={beat.scene_description}
              maxLength={1200}
              disabled={disabled}
              onChange={(e) => handleSceneChange(e.target.value)}
              style={{ ...textareaStyle, minHeight: 96 }}
            />
            <span style={fieldHelperText}>{BEAT_SHEET_REVIEW.scene_helper}</span>
          </label>
        </div>
      ) : (
        <div style={readOnlyStack}>
          <p style={captionDisplay}>
            {beat.caption || (
              <span style={emptyPlaceholder}>
                (No caption yet — tap Edit to add one.)
              </span>
            )}
          </p>
          <p style={sceneDisplay}>{truncate(beat.scene_description, 180)}</p>
          {caption_too_long ? (
            <CaptionWarning wordCount={caption_word_count} />
          ) : null}
        </div>
      )}
    </article>
  );
}

// -----------------------------------------------------------------------------
// Counter + warning sub-components.
// -----------------------------------------------------------------------------

function CaptionCounter({
  id,
  wordCount,
  tooLong,
}: {
  id: string;
  wordCount: number;
  tooLong: boolean;
}) {
  if (tooLong) {
    return (
      <span
        id={id}
        role="status"
        aria-live="polite"
        style={counterWarningStyle}
      >
        {BEAT_SHEET_CAPTION_WARNING.over_limit.replace(
          "[N]",
          String(wordCount),
        )}
      </span>
    );
  }
  const remaining = CAPTION_WORD_LIMIT - wordCount;
  return (
    <span id={id} style={counterStyle}>
      {BEAT_SHEET_REVIEW.caption_helper}{" "}
      <span style={{ opacity: 0.7 }}>({remaining} words left)</span>
    </span>
  );
}

function CaptionWarning({ wordCount }: { wordCount: number }) {
  return (
    <p style={inlineWarning} role="status" aria-live="polite">
      {BEAT_SHEET_CAPTION_WARNING.over_limit.replace("[N]", String(wordCount))}
    </p>
  );
}

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------

function truncate(s: string, max: number): string {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// -----------------------------------------------------------------------------
// Styles — inline, tokens-only, matches ConfirmationCard / GateReview rhythm.
// -----------------------------------------------------------------------------

const cardWrap: CSSProperties = {
  background: "#FFFBF3",
  border: `1px solid ${C.line}`,
  borderRadius: 18,
  padding: "20px 22px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const labelStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const beatLabelStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 20,
  lineHeight: 1.2,
  color: C.ink,
  fontWeight: 400,
  letterSpacing: "-0.005em",
};

const archetypeStyle: CSSProperties = {
  display: "inline-block",
  alignSelf: "flex-start",
  padding: "3px 10px",
  borderRadius: 999,
  background: C.blush,
  color: C.inkSoft,
  fontFamily: FONT_SANS,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const editButton = (disabled: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 16px",
  borderRadius: 999,
  fontFamily: FONT_SANS,
  fontSize: 13,
  fontWeight: 500,
  border: `1px solid ${C.line}`,
  background: "transparent",
  color: C.inkSoft,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  letterSpacing: "0.01em",
  flexShrink: 0,
});

const readOnlyStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const captionDisplay: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 17,
  lineHeight: 1.45,
  color: C.ink,
};

const sceneDisplay: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 14,
  lineHeight: 1.55,
  color: C.inkSofter,
};

const emptyPlaceholder: CSSProperties = {
  fontStyle: "italic",
  opacity: 0.6,
};

const editorStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const fieldLabelStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontFamily: FONT_SANS,
};

const fieldLabelText: CSSProperties = {
  fontSize: 12,
  color: C.inkSoft,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const fieldHelperText: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: C.inkSofter,
  lineHeight: 1.5,
};

const textareaStyle: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 14,
  lineHeight: 1.55,
  color: C.ink,
  background: C.cream,
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  padding: "10px 12px",
  outline: "none",
  resize: "vertical",
  width: "100%",
  boxSizing: "border-box",
};

const counterStyle: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: C.inkSofter,
  lineHeight: 1.5,
};

const counterWarningStyle: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: C.goldDeep,
  lineHeight: 1.5,
  fontWeight: 500,
};

const inlineWarning: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: C.goldDeep,
  lineHeight: 1.5,
  fontWeight: 500,
};
