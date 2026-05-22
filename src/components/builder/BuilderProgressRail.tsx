"use client";

import { useState } from "react";
import { C, FONT_SANS } from "@/lib/peterna-tokens";
import type { StageTag } from "@/lib/builder/state";

// Informational progress rail. Slim horizontal sequence of 8 segments
// covering the full ~20-stage builder journey. Per audit CC-4: the wizard
// previously had no positional cue beyond StageBanner. This gives the user
// spatial certainty.
//
// Behaviour:
//   - Current segment: filled C.gold.
//   - Past segments:   filled C.inkSoft at 80% opacity.
//   - Future segments: outlined C.line, transparent fill.
//   - No click-to-navigate. Purely informational.
//   - Hover reveals a small inline tooltip ("Segment name — Stage N of 9").
//   - Hidden by the parent (WizardShell) on intake_welcome so the welcome
//     stays held with no chrome.

// 8 user-facing segments. Order matches the journey:
//   0 Intake (1.0–1.12)
//   1 Character (2, 2.5, 2.6)
//   2 Style (Stage 3 family)
//   3 Beats (Stage 4)
//   4 Storyboard (Stage 5)
//   5 Words (5.5, 5.6)
//   6 Cinema (5.7)
//   7 Video (6, 7)
//   8 Eulogy (Stage 8 + delivery)
const SEGMENT_LABELS = [
  "Intake",
  "Character",
  "Style",
  "Beats",
  "Storyboard",
  "Words",
  "Cinema",
  "Video",
  "Eulogy",
] as const;

// Map every StageTag to its segment index. Welcome is segment 0 even though
// the parent hides the rail on the welcome screen — keeping the mapping
// complete avoids any TS narrowing gaps.
export const STAGE_TO_RAIL_SEGMENT: Record<StageTag, number> = {
  // Intake — Stages 1.0 through 1.13
  intake_welcome: 0,
  intake_returning_user_check: 0,
  intake_photos: 0,
  intake_name: 0,
  intake_name_pronunciation: 0,
  intake_vision_review: 0,
  intake_memory: 0,
  intake_memory_freetext: 0,
  intake_gender: 0,
  intake_relationship: 0,
  intake_traits: 0,
  intake_favorites: 0,
  intake_creator: 0,
  intake_years: 0,
  intake_complete: 0,

  // Character — Stage 2 + 2.5 + 2.6
  character_sheet_render: 1,
  character_sheet_review: 1,
  character_sheet_refinement: 1,
  length_pick: 1,
  aspect_pick: 1,

  // Style — Stage 3 family
  curators_pick_or_manual: 2,
  curator_style_confirm: 2,
  format_pick: 2,
  theme_category_pick: 2,
  theme_pick: 2,
  style_pick: 2,
  combination_preview_render: 2,
  combination_preview_review: 2,
  stage_3_complete: 2,

  // Beats — Stage 4
  beat_sheet_render: 3,
  beat_sheet_review: 3,
  beat_sheet_complete: 3,

  // Storyboard — Stage 5
  storyboard_render: 4,
  storyboard_review: 4,
  storyboard_frame_reroll: 4,
  storyboard_complete: 4,

  // Words — Stage 5.5 + 5.6
  words_render: 5,
  words_editor: 5,
  words_complete: 5,
  card_preview_render: 5,
  card_preview_review: 5,
  card_preview_complete: 5,

  // Cinema — Stage 5.7
  cinematography_brief: 6,
  cinematography_render: 6,
  cinematography_review: 6,
  cinematography_complete: 6,

  // Video — Stage 6 + Stage 7 assembly
  video_render: 7,
  video_review: 7,
  assembly_render: 7,
  assembly_review: 7,
  assembly_complete: 7,

  // Eulogy + delivery
  eulogy_render: 8,
  eulogy_review: 8,
  eulogy_complete: 8,
  delivery_ready: 8,
  delivery_emailed: 8,
};

type Props = {
  currentStage: StageTag;
};

export default function BuilderProgressRail({ currentStage }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const currentIdx = STAGE_TO_RAIL_SEGMENT[currentStage] ?? 0;
  const totalSegments = SEGMENT_LABELS.length;

  return (
    <div
      role="group"
      aria-label={`Builder progress — ${SEGMENT_LABELS[currentIdx]}, stage ${
        currentIdx + 1
      } of ${totalSegments}`}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        margin: "0 0 20px",
        // Don't grow into the page; sit inline under the global Nav.
        width: "100%",
        position: "relative",
      }}
    >
      {SEGMENT_LABELS.map((label, i) => {
        const isCurrent = i === currentIdx;
        const isPast = i < currentIdx;
        const segmentLabel = `${label} — stage ${i + 1} of ${totalSegments}`;
        const background = isCurrent
          ? C.gold
          : isPast
            ? C.inkSoft
            : "transparent";
        const border =
          isCurrent || isPast ? "1px solid transparent" : `1px solid ${C.line}`;
        const opacity = isPast ? 0.8 : 1;

        return (
          <div
            key={label}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx((v) => (v === i ? null : v))}
            onFocus={() => setHoverIdx(i)}
            onBlur={() => setHoverIdx((v) => (v === i ? null : v))}
            tabIndex={0}
            aria-label={segmentLabel}
            aria-current={isCurrent ? "step" : undefined}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              background,
              border,
              opacity,
              position: "relative",
              cursor: "default",
              outline: "none",
            }}
          >
            {hoverIdx === i ? (
              <span
                role="tooltip"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontFamily: FONT_SANS,
                  fontSize: 11,
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                  background: C.ink,
                  color: C.cream,
                  padding: "5px 9px",
                  borderRadius: 6,
                  zIndex: 5,
                  pointerEvents: "none",
                  // High enough not to be cropped by the banner below; the
                  // wizard's NARROW_MAX gives us a 40px horizontal gutter to
                  // breathe into.
                }}
              >
                {label}
                <span style={{ opacity: 0.7, marginLeft: 6 }}>
                  Stage {i + 1} of {totalSegments}
                </span>
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
