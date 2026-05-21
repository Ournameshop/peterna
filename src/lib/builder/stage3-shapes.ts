// Stage 3 library content — consumer-side type shapes.
//
// The library values live in the backend-owned files
// (`src/lib/library/{formats,themes,theme-categories,curators-picks}.ts`).
// Field names mirror the backend's actual exports (label/secondary/_id) which
// in turn mirror the spec YAML — the grid components read those snake_case
// names directly, no casts needed.

import type { ArtStyleId } from '@/lib/library/art-styles';

/** Curator's Pick — one of the 4+ pre-paired format+theme+style presets. */
export type CuratorPickShape = {
  readonly id: string;
  readonly label: string;
  readonly secondary: string;
  readonly format_id: string;
  readonly theme_id: string;
  readonly style_id: ArtStyleId | string;
  /** Optional icon for the rich pill (emoji or short string). */
  readonly icon?: string;
  /** Relationship-bias slugs — the spec uses `curators_pick_priority` on the
   *  relationships table to match into this list. */
  readonly relationship_bias?: ReadonlyArray<string>;
};

/** Format — one of the 8 ship-with tribute formats. */
export type FormatShape = {
  readonly id: string;
  readonly label: string;
  readonly secondary: string;
  /** Optional emoji / icon for the rich pill. */
  readonly icon?: string;
};

/** Theme — one of the 12 visual worlds, grouped under a category. */
export type ThemeShape = {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly secondary: string;
  readonly icon?: string;
};

/** Theme category — emotional grouping for the 12 themes. */
export type ThemeCategoryShape = {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly secondary: string;
  readonly theme_ids: ReadonlyArray<string>;
};
