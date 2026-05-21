"use client";

import { useMemo } from "react";
import PillPicker, { type Pill } from "./PillPicker";
import {
  CURATOR_STYLE_CONFIRM,
} from "@/lib/library/copy";
import {
  ART_STYLES,
  type ArtStyleId,
  findArtStyle,
} from "@/lib/library/art-styles";

// Stage 3.1.5 — Style confirmation after Curator's Pick (v2.3).
//
// A one-screen pill picker. Shows the Curator's Pick's locked-in style first
// (with a "Keep [STYLE_NAME]" framing and `keep_secondary` subtitle), then
// the other 7 styles as switch options. Tapping Keep advances to the
// combination-preview render unchanged; tapping any other style replaces only
// the `style_id` (format + theme stay locked from the Curator's Pick).
//
// Spec rule (§3.1.5): "Suppress the duplicate 'Keep' pill if it would name the
// same style as the next pill in the row — only show 8 pills total." Concretely
// the "Keep" pill replaces the matching style's switch pill at position #0.

const KEEP_PILL_ID = "__keep_curator_style__";

type Props = {
  /** The style currently locked in by the Curator's Pick. */
  currentStyleId: ArtStyleId | string;
  onKeep: () => void;
  onSwitch: (styleId: ArtStyleId) => void;
};

export default function CuratorStyleConfirm({
  currentStyleId,
  onKeep,
  onSwitch,
}: Props) {
  const currentStyle = findArtStyle(currentStyleId);

  // Pills: "Keep <current>" first, then every other style. The current
  // style's switch pill is suppressed (it's already represented by Keep).
  const pills: Pill[] = useMemo(() => {
    const out: Pill[] = [];
    if (currentStyle) {
      out.push({
        id: KEEP_PILL_ID,
        label: CURATOR_STYLE_CONFIRM.keep_label_template.replace(
          "[STYLE_NAME]",
          currentStyle.label,
        ),
        description: CURATOR_STYLE_CONFIRM.keep_secondary,
      });
    }
    for (const style of ART_STYLES) {
      if (style.id === currentStyleId) continue;
      out.push({
        id: style.id,
        label: style.label,
        description: style.eligible_for_curators_pick
          ? undefined
          : CURATOR_STYLE_CONFIRM.opt_in_secondary,
      });
    }
    return out;
  }, [currentStyle, currentStyleId]);

  const question = currentStyle
    ? CURATOR_STYLE_CONFIRM.question.replace("[STYLE_NAME]", currentStyle.label)
    : CURATOR_STYLE_CONFIRM.question.replace("[STYLE_NAME]", "this style");

  return (
    <PillPicker
      question={question}
      hint={CURATOR_STYLE_CONFIRM.hint}
      pills={pills}
      variant="rich"
      autoSubmitOnPick
      onSubmit={(ids) => {
        const picked = ids[0];
        if (picked === KEEP_PILL_ID) {
          onKeep();
          return;
        }
        onSwitch(picked as ArtStyleId);
      }}
    />
  );
}
