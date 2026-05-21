"use client";

import { useMemo } from "react";
import PillPicker, { type Pill } from "./PillPicker";
import { FORMAT_FRAMING, substitutePetName } from "@/lib/library/copy";
import { FORMATS } from "@/lib/library/formats";
import type { FormatShape } from "@/lib/builder/stage3-shapes";

// Stage 3.2 — Format grid (manual path).
//
// Shows all 8 ship-with formats as rich pills (icon + name + one-line
// description). On select: parent receives the format id and advances to
// theme_category_pick.
//
// Per the "Tiered thumbnail reveal" rule, this screen does NOT render
// per-pet thumbnails — only stock label + description + (optional) icon.
// The combination-preview at Stage 3.5 is the single per-pet render.

type Props = {
  petName: string | null;
  onChosen: (formatId: string) => void;
};

export default function FormatGrid({ petName, onChosen }: Props) {
  const formats = FORMATS as ReadonlyArray<FormatShape>;

  const pills: Pill[] = useMemo(
    () =>
      formats.map((f) => ({
        id: f.id,
        // Substitute [PET_NAME] in format names like "Postcards From [PET_NAME]".
        label: substitutePetName(f.label, petName),
        description: f.secondary,
        icon: f.icon,
      })),
    [formats, petName],
  );

  return (
    <PillPicker
      question={FORMAT_FRAMING.question}
      hint={FORMAT_FRAMING.hint}
      pills={pills}
      variant="rich"
      autoSubmitOnPick
      onSubmit={(ids) => onChosen(ids[0])}
    />
  );
}
