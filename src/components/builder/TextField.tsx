"use client";

import { useId, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { C, FONT_SANS } from "@/lib/peterna-tokens";

// Pattern D — free-text input. Used for pet name, pronunciation, memory
// free-text follow-up, creator name, years label, Stage 2.3 refinement
// notes.

type Props = {
  question: string;
  placeholder?: string;
  multiline?: boolean;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
  submitLabel?: string;
  skipLabel?: string;
  onSubmit: (value: string) => void;
  onSkip?: () => void;
  submitting?: boolean;
  // If true, an empty submission is treated as a "skip" (calling onSkip)
  // rather than blocked. Used for the optional fields (creator, years).
  allowEmpty?: boolean;
};

export default function TextField({
  question,
  placeholder,
  multiline = false,
  defaultValue = "",
  required = false,
  maxLength,
  submitLabel = "Continue",
  skipLabel,
  onSubmit,
  onSkip,
  submitting = false,
  allowEmpty = false,
}: Props) {
  const inputId = useId();
  const [value, setValue] = useState(defaultValue);
  const trimmed = value.trim();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (trimmed.length === 0) {
      if (allowEmpty && onSkip) {
        onSkip();
        return;
      }
      if (required) return;
    }
    onSubmit(trimmed);
  }

  const canSubmit =
    !submitting && (trimmed.length > 0 || allowEmpty || !required);

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
      aria-label={question}
    >
      <label
        htmlFor={inputId}
        style={{
          fontFamily: FONT_SANS,
          fontSize: 20,
          fontWeight: 500,
          color: C.ink,
          lineHeight: 1.4,
        }}
      >
        {question}
      </label>

      {multiline ? (
        <textarea
          id={inputId}
          rows={4}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          style={{
            fontFamily: FONT_SANS,
            fontSize: 15,
            lineHeight: 1.55,
            color: C.ink,
            background: "#FFFBF3",
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            padding: "14px 16px",
            outline: "none",
            resize: "vertical",
            minHeight: 110,
          }}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          style={{
            fontFamily: FONT_SANS,
            fontSize: 16,
            color: C.ink,
            background: "#FFFBF3",
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            padding: "14px 16px",
            outline: "none",
          }}
        />
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
        <motion.button
          type="submit"
          disabled={!canSubmit}
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
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Saving…" : submitLabel}
        </motion.button>

        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            style={{
              background: "transparent",
              border: "none",
              color: C.inkSofter,
              fontFamily: FONT_SANS,
              fontSize: 13,
              cursor: "pointer",
              padding: "12px 16px",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {skipLabel ?? "Skip"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
