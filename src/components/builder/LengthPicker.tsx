"use client";

import PillPicker, { type Pill } from "./PillPicker";
import { LENGTH_FRAMING, substitutePetName } from "@/lib/library/copy";

// Stage 2.5 — Length picker.
//
// Three pills with emotion-first labels:
//   - A short keepsake (2 min · 8 beats)
//   - A full tribute (3 min · 12 beats) — recommended/default-selected
//   - An extended remembrance (4 min · 16 beats)
//
// Per spec §2.5 the labels are emotional first, minutes/beats are secondary.
// The picker auto-submits on tap; the parent receives `target_minutes` and
// `beat_count` together and advances the stage via PATCH.

const LENGTH_OPTIONS = [
  { id: "short", target_minutes: 2, beat_count: 8 },
  { id: "full", target_minutes: 3, beat_count: 12 },
  { id: "extended", target_minutes: 4, beat_count: 16 },
] as const;

type LengthOptionId = (typeof LENGTH_OPTIONS)[number]["id"];

type Props = {
  petName: string | null;
  onChosen: (targetMinutes: number, beatCount: number) => void;
};

export default function LengthPicker({ petName, onChosen }: Props) {
  const pills: Pill[] = [
    {
      id: "short",
      label: LENGTH_FRAMING.pills.short.label,
      description: LENGTH_FRAMING.pills.short.description,
    },
    {
      id: "full",
      label: LENGTH_FRAMING.pills.full.label,
      description: LENGTH_FRAMING.pills.full.description,
      badge: LENGTH_FRAMING.pills.full.badge,
    },
    {
      id: "extended",
      label: LENGTH_FRAMING.pills.extended.label,
      description: LENGTH_FRAMING.pills.extended.description,
    },
  ];

  return (
    <PillPicker
      question={substitutePetName(LENGTH_FRAMING.question, petName)}
      hint={LENGTH_FRAMING.hint}
      pills={pills}
      variant="rich"
      defaultSelected={["full"]}
      autoSubmitOnPick
      onSubmit={(ids) => {
        const choice = LENGTH_OPTIONS.find((o) => o.id === (ids[0] as LengthOptionId));
        if (!choice) return;
        onChosen(choice.target_minutes, choice.beat_count);
      }}
    />
  );
}
