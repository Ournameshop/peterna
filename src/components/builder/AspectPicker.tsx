"use client";

import PillPicker, { type Pill } from "./PillPicker";
import { ASPECT_FRAMING, substitutePetName } from "@/lib/library/copy";
import type { AspectRatio } from "@/lib/builder/state";

// Stage 2.6 — Aspect picker.
//
// Three pills (phone / TV / social feeds) with `9:16` vertical as default.
// The picker writes `aspect_ratio` to the session and advances to
// `curators_pick_or_manual` (Stage 3 entry — but in this phase, the Stage 3
// screen itself isn't built; we just route the stage transition).
//
// Spec note: the "All three formats" option exists in the spec but is left
// off until letterboxing is wired (Phase 7+ assembly). Web Phase 2 ships with
// the three primary aspect picks only.

const ASPECT_OPTIONS: ReadonlyArray<{ id: string; ratio: AspectRatio }> = [
  { id: "phone", ratio: "9:16" },
  { id: "tv", ratio: "16:9" },
  { id: "social", ratio: "1:1" },
];

type Props = {
  petName: string | null;
  onChosen: (ratio: AspectRatio) => void;
};

export default function AspectPicker({ petName, onChosen }: Props) {
  const pills: Pill[] = [
    {
      id: "phone",
      label: ASPECT_FRAMING.pills.phone.label,
      description: ASPECT_FRAMING.pills.phone.description,
      badge: ASPECT_FRAMING.pills.phone.badge,
    },
    {
      id: "tv",
      label: ASPECT_FRAMING.pills.tv.label,
      description: ASPECT_FRAMING.pills.tv.description,
    },
    {
      id: "social",
      label: ASPECT_FRAMING.pills.social.label,
      description: ASPECT_FRAMING.pills.social.description,
    },
  ];

  return (
    <PillPicker
      question={substitutePetName(ASPECT_FRAMING.question, petName)}
      pills={pills}
      variant="rich"
      defaultSelected={["phone"]}
      autoSubmitOnPick
      onSubmit={(ids) => {
        const choice = ASPECT_OPTIONS.find((o) => o.id === ids[0]);
        if (!choice) return;
        onChosen(choice.ratio);
      }}
    />
  );
}
