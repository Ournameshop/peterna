"use client";

import { useMemo } from "react";
import PillPicker, { type Pill } from "./PillPicker";
import { STYLE_FRAMING, substitutePetName } from "@/lib/library/copy";
import { ART_STYLES, type ArtStyleId } from "@/lib/library/art-styles";
import { RELATIONSHIPS, type RelationshipId } from "@/lib/library/relationships";
import { C, FONT_SANS } from "@/lib/peterna-tokens";

// Stage 3.4 — Art style grid (manual path).
//
// Per spec §3.4, the 8 art styles are presented in two visual rows with a
// subtle divider:
//   - "Warm and traditional" — cinematic, watercolor, storybook, 3D animated,
//     claymation, pencil sketch (6 styles, all eligible_for_curators_pick).
//   - "Playful and stylized" — pixel art, voxel (the 2 explicit-opt-in
//     styles).
//
// We split the styles into two `<PillPicker>` instances, each with its own
// hint, and render a thin horizontal divider between them. They share a
// single "controlled" selection so the auto-submit-on-pick semantics still
// work whichever row the user taps. Internally each picker is independent
// and just routes its choice up to the parent.

// Style emoji icons match the spec §3.4 listing.
const STYLE_ICON: Record<ArtStyleId, string> = {
  cinematic_realism: "🎬",
  watercolor: "🎨",
  storybook_illustration: "✏️",
  animated_3d: "🧸",
  claymation: "🤏",
  pencil_sketch: "📝",
  pixel_art: "🟪",
  voxel_minecraft: "🧊",
};

type Props = {
  petName: string | null;
  relationship: RelationshipId | null;
  onChosen: (styleId: ArtStyleId) => void;
};

export default function StyleGrid({
  petName,
  relationship,
  onChosen,
}: Props) {
  const warm = useMemo(
    () => ART_STYLES.filter((s) => s.eligible_for_curators_pick),
    [],
  );
  const playful = useMemo(
    () => ART_STYLES.filter((s) => !s.eligible_for_curators_pick),
    [],
  );

  // Relationship-driven silent default (spec §3.1 manual-path).
  const defaultStyleId = useMemo<ArtStyleId | undefined>(() => {
    if (!relationship) return undefined;
    const rel = RELATIONSHIPS.find((r) => r.id === relationship);
    const bias = rel?.default_style_bias ?? [];
    for (const id of bias) {
      const hit = ART_STYLES.find((s) => s.id === id);
      if (hit) return hit.id;
    }
    return undefined;
  }, [relationship]);

  const warmPills: Pill[] = warm.map((s) => ({
    id: s.id,
    label: s.label,
    icon: STYLE_ICON[s.id],
  }));
  const playfulPills: Pill[] = playful.map((s) => ({
    id: s.id,
    label: s.label,
    icon: STYLE_ICON[s.id],
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
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
        {substitutePetName(STYLE_FRAMING.question, petName)}
      </h2>

      <section
        aria-label={STYLE_FRAMING.group_warm_label}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: C.inkSofter,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {STYLE_FRAMING.group_warm_label}
        </p>
        <PillPicker
          pills={warmPills}
          variant="rich"
          autoSubmitOnPick
          defaultSelected={
            defaultStyleId && warm.some((s) => s.id === defaultStyleId)
              ? [defaultStyleId]
              : []
          }
          onSubmit={(ids) => onChosen(ids[0] as ArtStyleId)}
        />
      </section>

      <hr
        aria-hidden="true"
        style={{
          margin: "4px 0",
          border: "none",
          borderTop: `1px dashed ${C.line}`,
        }}
      />

      <section
        aria-label={STYLE_FRAMING.group_playful_label}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: C.inkSofter,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {STYLE_FRAMING.group_playful_label}
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: C.inkSofter,
            lineHeight: 1.5,
          }}
        >
          {STYLE_FRAMING.group_playful_hint}
        </p>
        <PillPicker
          pills={playfulPills}
          variant="rich"
          autoSubmitOnPick
          onSubmit={(ids) => onChosen(ids[0] as ArtStyleId)}
        />
      </section>
    </div>
  );
}
