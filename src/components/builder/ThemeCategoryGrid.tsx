"use client";

import { useMemo } from "react";
import PillPicker, { type Pill } from "./PillPicker";
import { THEME_CATEGORY_FRAMING } from "@/lib/library/copy";
import { THEME_CATEGORIES } from "@/lib/library/themes";
import { RELATIONSHIPS, type RelationshipId } from "@/lib/library/relationships";
import type { ThemeCategoryShape } from "@/lib/builder/stage3-shapes";

// Stage 3.3a — Theme category grid.
//
// 6 emotional categories as rich pills (emoji + name + one-line description).
// On select: parent stores the category id (transient — used to filter the
// next screen) and advances to theme_pick.
//
// Relationship-driven pre-selection (spec §3.1 manual-path silent defaults):
// when the user lands here from the manual path, the category whose id matches
// one of the relationship's `default_theme_bias` themes is pre-selected as a
// default. The user can still tap any of the 6 — this is just a hint.

type Props = {
  relationship: RelationshipId | null;
  onChosen: (categoryId: string) => void;
};

export default function ThemeCategoryGrid({ relationship, onChosen }: Props) {
  const categories = THEME_CATEGORIES as ReadonlyArray<ThemeCategoryShape>;

  const defaultCategoryId = useMemo<string | undefined>(() => {
    if (!relationship) return undefined;
    const rel = RELATIONSHIPS.find((r) => r.id === relationship);
    if (!rel || rel.default_theme_bias.length === 0) return undefined;
    // Find the first category that contains a bias-listed theme.
    for (const themeId of rel.default_theme_bias) {
      const hit = categories.find((c) => c.theme_ids.includes(themeId));
      if (hit) return hit.id;
    }
    return undefined;
  }, [relationship, categories]);

  const pills: Pill[] = useMemo(
    () =>
      categories.map((c) => ({
        id: c.id,
        label: c.name,
        description: c.description,
        icon: c.emoji,
      })),
    [categories],
  );

  return (
    <PillPicker
      question={THEME_CATEGORY_FRAMING.question}
      hint={THEME_CATEGORY_FRAMING.hint}
      pills={pills}
      variant="rich"
      autoSubmitOnPick
      defaultSelected={defaultCategoryId ? [defaultCategoryId] : []}
      onSubmit={(ids) => onChosen(ids[0])}
    />
  );
}
