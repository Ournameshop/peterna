"use client";

import { useMemo } from "react";
import PillPicker, { type Pill } from "./PillPicker";
import {
  CURATORS_PICK_FRAMING,
  substitutePetName,
} from "@/lib/library/copy";
import { CURATORS_PICKS } from "@/lib/library/curators-picks";
import { RELATIONSHIPS, type RelationshipId } from "@/lib/library/relationships";
import { reorderCuratorPicks } from "@/lib/builder/state";
import type { CuratorPickShape } from "@/lib/builder/stage3-shapes";

// Stage 3.1 — Curator's Picks grid + manual-path entrypoint.
//
// Renders the 4+ Curator's Picks as rich pills (icon + label + tagline). The
// list is REORDERED based on the user's relationship: the pick whose `id`
// matches the relationship's `curators_pick_priority` is moved to position #1
// and tagged with a subtitle ("Based on what [PET_NAME] was to you"). The
// remaining picks follow in their default library order.
//
// A final pill ("Help me choose myself") leads to the manual path (3.2 →
// theme category → theme → style).

type Props = {
  petName: string | null;
  relationship: RelationshipId | null;
  onPickCurator: (pick: CuratorPickShape) => void;
  onPickManual: () => void;
};

const MANUAL_PILL_ID = "__manual_path__";

export default function CuratorPickGrid({
  petName,
  relationship,
  onPickCurator,
  onPickManual,
}: Props) {
  // The library is owned by the backend; cast to the consumer shape so the UI
  // component is type-checked against the fields it actually renders.
  const allPicks = CURATORS_PICKS as ReadonlyArray<CuratorPickShape>;

  const { orderedPicks, priorityId } = useMemo(() => {
    const rel = RELATIONSHIPS.find((r) => r.id === relationship);
    const priority = rel?.curators_pick_priority ?? null;
    return {
      orderedPicks: reorderCuratorPicks(allPicks, priority),
      priorityId: priority,
    };
  }, [allPicks, relationship]);

  const pills: Pill[] = useMemo(() => {
    const subtitle = substitutePetName(
      CURATORS_PICK_FRAMING.relationship_subtitle,
      petName,
    );
    return [
      ...orderedPicks.map<Pill>((pick, idx) => {
        const isPriorityHit = idx === 0 && pick.id === priorityId;
        // Compose the rich-pill description: the matched (#1) pick prepends
        // the "Based on what [PET_NAME] was to you" subtitle to give the
        // reorder a reason. Other picks just show their tagline.
        const description = isPriorityHit
          ? `${subtitle}\n${pick.tagline}`
          : pick.tagline;
        return {
          id: pick.id,
          label: pick.name,
          description,
          icon: pick.icon,
        };
      }),
      {
        id: MANUAL_PILL_ID,
        label: CURATORS_PICK_FRAMING.manual_pill_label,
        description: CURATORS_PICK_FRAMING.manual_pill_description,
      },
    ];
  }, [orderedPicks, priorityId, petName]);

  return (
    <PillPicker
      question={CURATORS_PICK_FRAMING.question}
      hint={CURATORS_PICK_FRAMING.hint}
      pills={pills}
      variant="rich"
      autoSubmitOnPick
      onSubmit={(ids) => {
        const picked = ids[0];
        if (picked === MANUAL_PILL_ID) {
          onPickManual();
          return;
        }
        const pick = orderedPicks.find((p) => p.id === picked);
        if (pick) onPickCurator(pick);
      }}
    />
  );
}
