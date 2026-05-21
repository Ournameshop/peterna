"use client";

import { useMemo, type CSSProperties } from "react";
import { motion } from "framer-motion";
import PillPicker, { type Pill } from "./PillPicker";
import {
  THEME_FRAMING,
  substitutePetName,
} from "@/lib/library/copy";
import { THEMES, THEME_CATEGORIES } from "@/lib/library/themes";
import { C, FONT_SANS } from "@/lib/peterna-tokens";
import type {
  ThemeCategoryShape,
  ThemeShape,
} from "@/lib/builder/stage3-shapes";

// Stage 3.3b — Theme grid (filtered to the picked category).
//
// Shows the 2 themes inside the chosen category as rich pills. On select:
// parent receives the theme id and advances to style_pick.
//
// Includes a "Back to categories" quiet button so a user who picked the
// wrong category isn't trapped. Per spec §3.3 this is the second of the
// two-tap theme flow.

type Props = {
  petName: string | null;
  /** The category the user picked on 3.3a — used to filter the theme list. */
  categoryId: string;
  onChosen: (themeId: string) => void;
  onBack: () => void;
};

export default function ThemeGrid({
  petName,
  categoryId,
  onChosen,
  onBack,
}: Props) {
  const themes = THEMES as ReadonlyArray<ThemeShape>;
  const categories = THEME_CATEGORIES as ReadonlyArray<ThemeCategoryShape>;

  const { category, scopedThemes } = useMemo(() => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return { category: null, scopedThemes: [] as ThemeShape[] };
    // Preserve the order defined on the category row, falling back to the
    // theme list order for any id we can't find.
    const byId = new Map(themes.map((t) => [t.id, t] as const));
    const scoped: ThemeShape[] = [];
    for (const id of cat.theme_ids) {
      const t = byId.get(id);
      if (t) scoped.push(t);
    }
    return { category: cat, scopedThemes: scoped };
  }, [categories, themes, categoryId]);

  const pills: Pill[] = useMemo(
    () =>
      scopedThemes.map((t) => ({
        id: t.id,
        label: t.label,
        description: t.secondary,
        icon: t.icon,
      })),
    [scopedThemes],
  );

  const backStyle: CSSProperties = {
    background: "transparent",
    border: "none",
    color: C.inkSofter,
    fontFamily: FONT_SANS,
    fontSize: 13,
    cursor: "pointer",
    padding: "8px 0",
    textDecoration: "underline",
    textUnderlineOffset: 3,
    alignSelf: "flex-start",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <motion.button
        type="button"
        onClick={onBack}
        whileHover={{ x: -2 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        style={backStyle}
      >
        ← {THEME_FRAMING.back_label}
      </motion.button>
      {category ? (
        <p
          style={{
            margin: 0,
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: C.inkSofter,
          }}
        >
          {category.icon} {category.label}
        </p>
      ) : null}
      <PillPicker
        question={substitutePetName(THEME_FRAMING.question, petName)}
        hint={THEME_FRAMING.hint}
        pills={pills}
        variant="rich"
        autoSubmitOnPick
        onSubmit={(ids) => onChosen(ids[0])}
      />
    </div>
  );
}
