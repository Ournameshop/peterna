"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { C, FONT_SANS } from "@/lib/peterna-tokens";

// One editable cell inside the cinematography brief table.
//
// Display mode = a small uppercase chip showing the current value.
// Edit mode    = a native <select> that opens on tap. Native selects are
//                accessible by default (keyboard, screen reader, mobile sheet),
//                cheap to render in an N-row table, and don't require any
//                custom popover positioning logic. The "popover" framing in
//                the spec is a UX intent — a tiny dropdown the user can
//                tap to pick a new value — and a native select is the
//                lowest-friction implementation of that intent.
//
// The cell owns NO derived state — the parent table passes `value`, `options`,
// and `onChange`. On change we close the editor immediately so the parent's
// PATCH side-effect runs without the user having to "save" twice.

export type CinematographyCellOption = {
  /** Engine wire value (snake_case enum) — what /api/cinematography accepts. */
  value: string;
  /** User-facing label — what the chip + dropdown display. */
  label: string;
};

type Props = {
  /** The current engine wire value. Must match one of `options[].value`. */
  value: string;
  /** Legal values for this field. Order is the dropdown order. */
  options: ReadonlyArray<CinematographyCellOption>;
  /** Accessible label for the editor (e.g. "Lens for beat 3"). */
  ariaLabel: string;
  /** Called when the user picks a new value. The parent PATCHes upstream. */
  onChange: (next: string) => void;
  /** When true, the chip is read-only (no editor opens on tap). */
  disabled?: boolean;
};

export default function CinematographyCell({
  value,
  options,
  ariaLabel,
  onChange,
  disabled = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const selectId = useId();

  // Focus the select as soon as we enter edit mode so keyboard users land
  // directly on the dropdown.
  useEffect(() => {
    if (editing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [editing]);

  const currentLabel =
    options.find((o) => o.value === value)?.label ?? value;

  const handleSelectChange = useCallback(
    (next: string) => {
      setEditing(false);
      if (next !== value) onChange(next);
    },
    [value, onChange],
  );

  if (editing && !disabled) {
    return (
      <select
        id={selectId}
        ref={selectRef}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => handleSelectChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
        style={selectStyle}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <button
      type="button"
      aria-label={`${ariaLabel}: ${currentLabel}. Tap to change.`}
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
      style={chipStyle(disabled)}
    >
      {currentLabel}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const chipStyle = (disabled: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 9px",
  borderRadius: 6,
  fontFamily: FONT_SANS,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: C.inkSoft,
  background: "rgba(233, 213, 195, 0.35)",
  border: `1px solid ${C.line}`,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.65 : 1,
  whiteSpace: "nowrap",
  textAlign: "left",
  lineHeight: 1.2,
});

const selectStyle: CSSProperties = {
  display: "inline-flex",
  padding: "4px 6px",
  borderRadius: 6,
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: C.ink,
  background: "#FFFBF3",
  border: `1px solid ${C.gold}`,
  boxShadow: `0 0 0 2px rgba(201, 169, 97, 0.25)`,
  cursor: "pointer",
  outline: "none",
  maxWidth: 180,
};
