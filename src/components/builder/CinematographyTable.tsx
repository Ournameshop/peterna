"use client";

import { useMemo, type CSSProperties } from "react";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { CINEMATOGRAPHY, BEAT_ARCHETYPE_LABELS } from "@/lib/library/copy";
import type {
  BeatWire,
  MotionBriefWire,
} from "@/lib/builder/wire-types";
import CinematographyCell, {
  type CinematographyCellOption,
} from "./CinematographyCell";

// Stage 5.7 brief review — the N-row table the user actually scans.
//
// Per spec rule: "The table is the user's ONLY view into the cinematography
// choices. Make it scannable — row per beat, columns left-to-right reading
// like a shot list."
//
// Layout decision: horizontal scroll on mobile, fully visible on desktop.
// We deliberately do NOT collapse columns — a shot-list table is only useful
// if every column is visible. Hiding columns behind a "show more" toggle
// breaks the at-a-glance scan that's the whole point of this screen.
//
// The horizontal scroll is wrapped inside a max-width container that takes
// the wizard's available width; on screens narrower than the natural table
// width the user swipes left/right. Sticky first column ("#") keeps the
// row identifier visible during the swipe.
//
// Per-field edit:
//   - Each cell is a <CinematographyCell>. Display mode = a small chip;
//     edit mode = a native dropdown of the legal values.
//   - On change we call onFieldChange(beat_idx, fieldName, newValue). The
//     parent constructs the PATCH payload + updates the brief in place.

export type CinematographyFieldName =
  | "lens_mm"
  | "camera_move"
  | "move_intensity"
  | "subject_motion"
  | "lighting_motion"
  | "dof_behavior"
  | "shot_structure"
  | "ambient_audio"
  | "audio_intensity";

type Props = {
  briefs: ReadonlyArray<MotionBriefWire>;
  /** Optional beat sheet so we can show archetype labels alongside the beat #.
   *  When omitted, the archetype column renders the raw archetype id. */
  beats?: ReadonlyArray<BeatWire> | null;
  /** Disable inline editing while a PATCH is in flight or while the table
   *  is being re-derived. */
  disabled?: boolean;
  onFieldChange: (
    beatIdx: number,
    field: CinematographyFieldName,
    next: string,
  ) => void;
};

// Legal field values — must match the wire-types unions in
// `src/lib/builder/wire-types.ts`. The order here is the dropdown order.
const FIELD_OPTIONS: Record<CinematographyFieldName, ReadonlyArray<string>> = {
  lens_mm: ["24", "35", "50", "85", "105"],
  camera_move: [
    "locked_off",
    "slow_push",
    "slow_pull",
    "slow_rise",
    "slow_fall",
    "slow_pan_L",
    "slow_pan_R",
    "slow_orbit",
    "parallax_dolly",
    "handheld_float",
    "dreamy_drift",
  ],
  move_intensity: ["barely_perceptible", "gentle", "pronounced"],
  subject_motion: [
    "locked",
    "breath_only",
    "loop_idle",
    "loop_action",
    "one_shot_action",
  ],
  lighting_motion: [
    "static",
    "drifting_sunbeam",
    "leaf_dapple_breeze",
    "candle_flicker",
    "dust_motes",
    "rim_light_pulse",
  ],
  dof_behavior: [
    "locked_shallow",
    "locked_deep",
    "rack_to_subject",
    "rack_to_environment",
    "rack_to_caption",
  ],
  shot_structure: ["single_sustained", "two_shot_cut", "three_shot_montage"],
  ambient_audio: [
    "birdsong",
    "wind_grass",
    "hearth_crackle",
    "soft_rain",
    "water_lapping",
    "silence",
    "breath_only",
  ],
  audio_intensity: ["bed_only", "present", "forward"],
};

export default function CinematographyTable({
  briefs,
  beats,
  disabled = false,
  onFieldChange,
}: Props) {
  // Build per-field option arrays once. The label map is keyed by enum value
  // and lives in copy.ts — see CINEMATOGRAPHY.field_labels.
  const optionsByField = useMemo(() => {
    const out: Record<CinematographyFieldName, CinematographyCellOption[]> = {
      lens_mm: [],
      camera_move: [],
      move_intensity: [],
      subject_motion: [],
      lighting_motion: [],
      dof_behavior: [],
      shot_structure: [],
      ambient_audio: [],
      audio_intensity: [],
    };
    (Object.keys(FIELD_OPTIONS) as CinematographyFieldName[]).forEach((field) => {
      out[field] = FIELD_OPTIONS[field].map((v) => ({
        value: v,
        label: labelFor(field, v),
      }));
    });
    return out;
  }, []);

  if (briefs.length === 0) {
    return (
      <p style={emptyState}>
        No briefs yet. Tap &ldquo;Reapply derivation&rdquo; to compose the
        cinematography.
      </p>
    );
  }

  // Order briefs by beat_idx defensively — the backend may not guarantee order.
  const ordered = [...briefs].sort((a, b) => a.beat_idx - b.beat_idx);

  return (
    <div style={outerWrap}>
      <div style={scrollWrap} role="region" aria-label="Cinematography brief table" tabIndex={0}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...headCell, ...firstColHead }} scope="col">
                {CINEMATOGRAPHY.columns.beat}
              </th>
              <th style={headCell} scope="col">
                {CINEMATOGRAPHY.columns.archetype}
              </th>
              <th style={headCell} scope="col">
                {CINEMATOGRAPHY.columns.lens}
              </th>
              <th style={headCell} scope="col">
                {CINEMATOGRAPHY.columns.camera_move}
              </th>
              <th style={headCell} scope="col">
                {CINEMATOGRAPHY.columns.motion}
              </th>
              <th style={headCell} scope="col">
                {CINEMATOGRAPHY.columns.lighting}
              </th>
              <th style={headCell} scope="col">
                {CINEMATOGRAPHY.columns.dof}
              </th>
              <th style={headCell} scope="col">
                {CINEMATOGRAPHY.columns.shot}
              </th>
              <th style={headCell} scope="col">
                {CINEMATOGRAPHY.columns.audio}
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((brief, rowIdx) => {
              const beat = beats?.find((b) => b.idx === brief.beat_idx);
              const archetypeLabel = beat
                ? BEAT_ARCHETYPE_LABELS[beat.archetype] ?? beat.archetype
                : "—";
              const zebra = rowIdx % 2 === 1;
              return (
                <tr key={brief.beat_idx} style={zebra ? rowZebra : rowBase}>
                  <td style={{ ...bodyCell, ...firstColBody }}>
                    <span style={beatNumber}>{brief.beat_idx + 1}</span>
                  </td>
                  <td style={bodyCell}>
                    <span style={archetypeText}>{archetypeLabel}</span>
                  </td>
                  <td style={bodyCell}>
                    <CinematographyCell
                      value={String(brief.lens_mm)}
                      options={optionsByField.lens_mm}
                      ariaLabel={`Lens for beat ${brief.beat_idx + 1}`}
                      disabled={disabled}
                      onChange={(v) =>
                        onFieldChange(brief.beat_idx, "lens_mm", v)
                      }
                    />
                  </td>
                  <td style={bodyCell}>
                    <div style={stackedCell}>
                      <CinematographyCell
                        value={brief.camera_move}
                        options={optionsByField.camera_move}
                        ariaLabel={`Camera move for beat ${brief.beat_idx + 1}`}
                        disabled={disabled}
                        onChange={(v) =>
                          onFieldChange(brief.beat_idx, "camera_move", v)
                        }
                      />
                      <CinematographyCell
                        value={brief.move_intensity}
                        options={optionsByField.move_intensity}
                        ariaLabel={`Move intensity for beat ${
                          brief.beat_idx + 1
                        }`}
                        disabled={disabled}
                        onChange={(v) =>
                          onFieldChange(brief.beat_idx, "move_intensity", v)
                        }
                      />
                    </div>
                  </td>
                  <td style={bodyCell}>
                    <CinematographyCell
                      value={brief.subject_motion}
                      options={optionsByField.subject_motion}
                      ariaLabel={`Subject motion for beat ${brief.beat_idx + 1}`}
                      disabled={disabled}
                      onChange={(v) =>
                        onFieldChange(brief.beat_idx, "subject_motion", v)
                      }
                    />
                  </td>
                  <td style={bodyCell}>
                    <CinematographyCell
                      value={brief.lighting_motion}
                      options={optionsByField.lighting_motion}
                      ariaLabel={`Lighting motion for beat ${brief.beat_idx + 1}`}
                      disabled={disabled}
                      onChange={(v) =>
                        onFieldChange(brief.beat_idx, "lighting_motion", v)
                      }
                    />
                  </td>
                  <td style={bodyCell}>
                    <CinematographyCell
                      value={brief.dof_behavior}
                      options={optionsByField.dof_behavior}
                      ariaLabel={`Depth of field for beat ${brief.beat_idx + 1}`}
                      disabled={disabled}
                      onChange={(v) =>
                        onFieldChange(brief.beat_idx, "dof_behavior", v)
                      }
                    />
                  </td>
                  <td style={bodyCell}>
                    <CinematographyCell
                      value={brief.shot_structure}
                      options={optionsByField.shot_structure}
                      ariaLabel={`Shot structure for beat ${brief.beat_idx + 1}`}
                      disabled={disabled}
                      onChange={(v) =>
                        onFieldChange(brief.beat_idx, "shot_structure", v)
                      }
                    />
                  </td>
                  <td style={bodyCell}>
                    <div style={stackedCell}>
                      <CinematographyCell
                        value={brief.ambient_audio}
                        options={optionsByField.ambient_audio}
                        ariaLabel={`Ambient audio for beat ${brief.beat_idx + 1}`}
                        disabled={disabled}
                        onChange={(v) =>
                          onFieldChange(brief.beat_idx, "ambient_audio", v)
                        }
                      />
                      <CinematographyCell
                        value={brief.audio_intensity}
                        options={optionsByField.audio_intensity}
                        ariaLabel={`Audio intensity for beat ${
                          brief.beat_idx + 1
                        }`}
                        disabled={disabled}
                        onChange={(v) =>
                          onFieldChange(brief.beat_idx, "audio_intensity", v)
                        }
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={scrollHint} aria-hidden="true">
        Swipe across the table to see every column.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Label helper — engine wire value → user-facing chip label.
// -----------------------------------------------------------------------------

function labelFor(field: CinematographyFieldName, value: string): string {
  const labels = CINEMATOGRAPHY.field_labels;
  if (field === "lens_mm") {
    const map = labels.lens_mm as Record<string, string>;
    return map[value] ?? `${value}mm`;
  }
  const fieldMap = (labels as Record<string, Record<string, string>>)[field];
  if (fieldMap && fieldMap[value]) return fieldMap[value];
  // Fallback — humanise the snake_case enum if the label table missed it.
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const outerWrap: CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const scrollWrap: CSSProperties = {
  width: "100%",
  overflowX: "auto",
  borderRadius: 14,
  border: `1px solid ${C.line}`,
  background: "#FFFBF3",
  // Pleasant scrollbar in WebKit; harmless in other engines.
  WebkitOverflowScrolling: "touch",
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: 880,
  borderCollapse: "separate",
  borderSpacing: 0,
  fontFamily: FONT_SANS,
};

const headCell: CSSProperties = {
  position: "sticky",
  top: 0,
  background: "rgba(233, 213, 195, 0.6)",
  color: C.inkSoft,
  fontFamily: FONT_SANS,
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  textAlign: "left",
  padding: "10px 14px",
  borderBottom: `1px solid ${C.line}`,
  whiteSpace: "nowrap",
};

const firstColHead: CSSProperties = {
  position: "sticky",
  left: 0,
  zIndex: 2,
  background: "rgba(233, 213, 195, 0.85)",
  // Soft right edge so the sticky col separates visually during horizontal scroll.
  boxShadow: "inset -1px 0 0 rgba(0, 0, 0, 0.04)",
};

const rowBase: CSSProperties = {
  background: "transparent",
};

const rowZebra: CSSProperties = {
  background: "rgba(233, 213, 195, 0.18)",
};

const bodyCell: CSSProperties = {
  padding: "10px 14px",
  verticalAlign: "middle",
  borderBottom: `1px solid rgba(229, 219, 201, 0.5)`,
  fontFamily: FONT_SANS,
  fontSize: 13,
  color: C.ink,
};

const firstColBody: CSSProperties = {
  position: "sticky",
  left: 0,
  background: "inherit",
  zIndex: 1,
  boxShadow: "inset -1px 0 0 rgba(0, 0, 0, 0.04)",
};

const beatNumber: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  borderRadius: 12,
  background: C.ink,
  color: C.cream,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 13,
  lineHeight: 1,
  fontWeight: 500,
};

const archetypeText: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 12,
  fontWeight: 500,
  color: C.inkSoft,
  whiteSpace: "nowrap",
};

const stackedCell: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  alignItems: "flex-start",
};

const scrollHint: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 11,
  color: C.inkSofter,
  fontStyle: "italic",
  textAlign: "right",
};

const emptyState: CSSProperties = {
  margin: 0,
  padding: "40px 16px",
  textAlign: "center",
  fontSize: 14,
  color: C.inkSofter,
  fontFamily: FONT_SANS,
};
