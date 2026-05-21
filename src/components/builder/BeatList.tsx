"use client";

import { type CSSProperties } from "react";
import type { BeatWire } from "@/lib/builder/wire-types";
import BeatCard from "./BeatCard";

// The editable N-beat list. Owns no state of its own — purely controlled.
// The parent (BeatSheetView / BuilderClient) holds the canonical beats array
// and PATCH-saves whenever a beat changes.
//
// Per spec, edits are whole-array replace (the array is small; partial
// updates aren't worth the complexity). This component just constructs the
// updated array on each change and passes it back up.

type Props = {
  beats: ReadonlyArray<BeatWire>;
  disabled?: boolean;
  /** Called with the full updated beats array whenever any field on any
   *  beat changes. The parent debounces / PATCHes upstream. */
  onChange: (next: BeatWire[]) => void;
};

export default function BeatList({ beats, disabled = false, onChange }: Props) {
  const total = beats.length;

  function handleBeatChange(idx: number, next: BeatWire) {
    const updated = beats.map((b, i) => (i === idx ? next : b));
    onChange(updated);
  }

  if (total === 0) {
    // Defensive — the parent should not render an empty list, but render a
    // quiet placeholder rather than nothing so we don't surprise users with
    // a blank screen on an empty array.
    return (
      <p style={emptyState}>
        No beats yet. Tap &ldquo;Rewrite the whole sheet&rdquo; to try again.
      </p>
    );
  }

  return (
    <ol style={listStyle} aria-label="Beat sheet">
      {beats.map((beat, i) => (
        <li key={`${beat.idx}-${i}`} style={listItemStyle}>
          <BeatCard
            beat={beat}
            totalBeats={total}
            disabled={disabled}
            onChange={(next) => handleBeatChange(i, next)}
          />
        </li>
      ))}
    </ol>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  width: "100%",
};

const listItemStyle: CSSProperties = {
  width: "100%",
};

const emptyState: CSSProperties = {
  margin: 0,
  padding: "40px 16px",
  textAlign: "center",
  fontSize: 14,
  opacity: 0.7,
};
