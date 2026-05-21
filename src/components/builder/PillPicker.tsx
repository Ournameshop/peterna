"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { C, FONT_SANS } from "@/lib/peterna-tokens";

// Pattern B — pill picker (single or multi-select).
// One primitive used by gender / relationship / traits / favorites / memory
// prompt / future Stage 2+3 grids. Match the Buttons.tsx feel for tap
// affordances. No Tailwind classes — inline styles + tokens.

export type Pill = {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode; // emoji or SVG
  badge?: string;
};

type Props = {
  pills: ReadonlyArray<Pill>;
  multi?: boolean;
  defaultSelected?: ReadonlyArray<string>;
  variant?: "plain" | "rich";
  question?: string;
  hint?: string;
  onSubmit: (selectedIds: string[]) => void;
  onSkip?: () => void;
  submitLabel?: string;
  skipLabel?: string;
  submitting?: boolean;
  // When true, the picker auto-submits on a single-select tap (no continue
  // button). Useful for gender / relationship where each pill is itself a
  // choice the user is making.
  autoSubmitOnPick?: boolean;
  // Minimum picks for multi-select before submit is enabled.
  minPicks?: number;
  // Maximum picks for multi-select (UI-level — extra clicks ignored).
  maxPicks?: number;
};

const pillBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 18px",
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 500,
  fontFamily: FONT_SANS,
  cursor: "pointer",
  background: C.cream,
  color: C.ink,
  border: `1px solid ${C.line}`,
  letterSpacing: "0.01em",
  textAlign: "left",
};

const richBase: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 6,
  padding: "16px 18px",
  borderRadius: 16,
  fontSize: 15,
  fontFamily: FONT_SANS,
  cursor: "pointer",
  background: "#FFFBF3",
  color: C.ink,
  border: `1px solid ${C.line}`,
  textAlign: "left",
  width: "100%",
};

export default function PillPicker({
  pills,
  multi = false,
  defaultSelected = [],
  variant = "plain",
  question,
  hint,
  onSubmit,
  onSkip,
  submitLabel = "Continue",
  skipLabel,
  submitting = false,
  autoSubmitOnPick = false,
  minPicks,
  maxPicks,
}: Props) {
  const [selected, setSelected] = useState<string[]>([...defaultSelected]);

  const minRequired = minPicks ?? (multi ? 1 : 1);
  const canSubmit = !submitting && selected.length >= minRequired;

  function togglePill(id: string) {
    if (multi) {
      const isSelected = selected.includes(id);
      let next: string[];
      if (isSelected) {
        next = selected.filter((s) => s !== id);
      } else if (typeof maxPicks === "number" && selected.length >= maxPicks) {
        // ignore extra clicks past the cap
        return;
      } else {
        next = [...selected, id];
      }
      setSelected(next);
    } else {
      setSelected([id]);
      if (autoSubmitOnPick) {
        // Defer onSubmit to next frame so the visual selection lands
        // briefly before the parent transitions away.
        window.setTimeout(() => onSubmit([id]), 80);
      }
    }
  }

  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
      aria-label={question ?? "Pick an option"}
    >
      {question ? (
        <h2
          style={{
            fontFamily: FONT_SANS,
            fontSize: 20,
            fontWeight: 500,
            color: C.ink,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {question}
        </h2>
      ) : null}

      {hint ? (
        <p
          style={{
            margin: 0,
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: C.inkSofter,
          }}
        >
          {hint}
        </p>
      ) : null}

      <div
        role={multi ? "group" : "radiogroup"}
        aria-label={question ?? "Choices"}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: variant === "rich" ? 12 : 10,
          marginTop: 4,
          // rich variant spans the row in 1- or 2-column flow
          flexDirection: variant === "rich" ? "column" : "row",
        }}
      >
        {pills.map((p) => {
          const isSel = selected.includes(p.id);
          const style: CSSProperties =
            variant === "rich"
              ? {
                  ...richBase,
                  background: isSel ? "rgba(201, 169, 97, 0.12)" : "#FFFBF3",
                  borderColor: isSel ? C.gold : C.line,
                  boxShadow: isSel
                    ? `0 0 0 2px rgba(201, 169, 97, 0.25) inset`
                    : "none",
                }
              : {
                  ...pillBase,
                  background: isSel ? C.ink : C.cream,
                  color: isSel ? C.cream : C.ink,
                  borderColor: isSel ? C.ink : C.line,
                };

          return (
            <motion.button
              key={p.id}
              type="button"
              onClick={() => togglePill(p.id)}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              role={multi ? "checkbox" : "radio"}
              aria-checked={isSel}
              style={style}
            >
              {variant === "rich" ? (
                <>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 15,
                      fontWeight: 500,
                    }}
                  >
                    {p.icon ? (
                      <span aria-hidden="true" style={{ fontSize: 18 }}>
                        {p.icon}
                      </span>
                    ) : null}
                    {p.label}
                    {p.badge ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: C.goldDeep,
                          background: "rgba(201, 169, 97, 0.18)",
                          borderRadius: 999,
                          padding: "2px 8px",
                          fontWeight: 500,
                        }}
                      >
                        {p.badge}
                      </span>
                    ) : null}
                    {isSel ? (
                      <Check size={14} style={{ marginLeft: 6 }} />
                    ) : null}
                  </span>
                  {p.description ? (
                    <span
                      style={{
                        fontSize: 13,
                        color: C.inkSofter,
                        lineHeight: 1.45,
                      }}
                    >
                      {p.description}
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  {p.icon ? (
                    <span aria-hidden="true" style={{ fontSize: 16 }}>
                      {p.icon}
                    </span>
                  ) : null}
                  <span>{p.label}</span>
                  {isSel ? <Check size={14} /> : null}
                </>
              )}
            </motion.button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 18,
          flexWrap: "wrap",
        }}
      >
        {!autoSubmitOnPick ? (
          <motion.button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(selected)}
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
        ) : null}

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
    </section>
  );
}
