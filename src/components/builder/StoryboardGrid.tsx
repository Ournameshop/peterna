"use client";

import { type CSSProperties } from "react";
import type {
  BeatWire,
  StoryboardFrameWire,
} from "@/lib/builder/wire-types";
import StoryboardFrameCard from "./StoryboardFrameCard";

// Responsive grid of N storyboard frames — one per beat.
//
// Layout (per spec): 2 columns on mobile, 4 on desktop. Cards are sized by
// the aspect ratio of the tribute (9:16 default → tall portrait cards; 16:9 →
// wider landscape). Images lazy-load — the user can scroll through ~16
// frames without paying for everything up-front.
//
// The grid owns no per-card state. Each card manages its own expand /
// reroll panel; the parent (StoryboardView / BuilderClient) holds the
// canonical frames array.

type Props = {
  frames: ReadonlyArray<StoryboardFrameWire>;
  beats: ReadonlyArray<BeatWire>;
  aspectRatio?: string | null;
  /** Which beat_idx is currently being rerolled (if any). The matching card
   *  swaps to its own per-frame loading state; the rest stay visible. */
  rerollBeatIdx?: number | null;
  disabled?: boolean;
  onRerollFrame: (beatIdx: number, refinements: string[], notes: string | null) => void;
};

export default function StoryboardGrid({
  frames,
  beats,
  aspectRatio,
  rerollBeatIdx = null,
  disabled = false,
  onRerollFrame,
}: Props) {
  const total = beats.length;

  if (total === 0) {
    return (
      <p style={emptyState}>
        No frames yet. Tap &ldquo;Start over&rdquo; to try again.
      </p>
    );
  }

  // Build an idx-keyed lookup so missing frames render a "preparing…" card
  // (defensive — the backend should send a frame per beat, but a partial
  // result shouldn't crash the grid).
  const byIdx = new Map<number, StoryboardFrameWire>(
    frames.map((f) => [f.beat_idx, f]),
  );

  return (
    <ol style={gridStyle} aria-label="Storyboard frames">
      {beats.map((beat, i) => {
        const frame = byIdx.get(beat.idx) ?? null;
        const isRerolling = rerollBeatIdx === beat.idx;
        return (
          <li key={`${beat.idx}-${i}`} style={gridItemStyle}>
            <StoryboardFrameCard
              beat={beat}
              frame={frame}
              totalBeats={total}
              aspectRatio={aspectRatio}
              isRerolling={isRerolling}
              disabled={disabled || rerollBeatIdx !== null}
              onReroll={(refinements, notes) =>
                onRerollFrame(beat.idx, refinements, notes)
              }
            />
          </li>
        );
      })}
    </ol>
  );
}

// -----------------------------------------------------------------------------
// Styles — CSS grid with a responsive column count. We use `auto-fill` with
// a min column width so it gracefully drops from 4 → 3 → 2 → 1 as the
// container narrows. No JS resize listeners needed.
// -----------------------------------------------------------------------------

const gridStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  // minmax(220px, 1fr) yields 4 columns at ~960px+, 2 columns at ~480-720px,
  // and a single column on the narrowest phones. Matches the spec rule.
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  // Wider gap on desktop, tighter on phones — the grid template handles
  // shrinking columns; the gap stays steady so adjacent frames don't crowd.
  gap: 18,
  width: "100%",
};

const gridItemStyle: CSSProperties = {
  width: "100%",
  // Allow the card itself to set its height from aspect-ratio; the item
  // is just a flex container so the card fills it.
  display: "flex",
};

const emptyState: CSSProperties = {
  margin: 0,
  padding: "40px 16px",
  textAlign: "center",
  fontSize: 14,
  opacity: 0.7,
};
