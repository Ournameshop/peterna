// Stage 3 library content — consumer-side type shapes.
//
// The library values live in the backend-owned files
// (`src/lib/library/{formats,themes,curators-picks}.ts`). The Stage 3 grid
// components only need the fields they render — these interfaces describe that
// surface. We deliberately keep them narrow: any new column on a library entry
// shows up here only when a UI component needs it.
//
// The library exports are still the source of truth. These shapes are used in
// `as` casts at the import site to keep the UI components type-safe regardless
// of what the backend chooses to put on the row.

import type { ArtStyleId } from '@/lib/library/art-styles';

/** Curator's Pick — one of the 4+ pre-paired format+theme+style presets. */
export type CuratorPickShape = {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly format: string;
  readonly theme: string;
  readonly style: ArtStyleId | string;
  /** Optional icon for the rich pill (emoji or short string). */
  readonly icon?: string;
  /** Relationship-bias slugs — the spec uses `curators_pick_priority` on the
   *  relationships table to match into this list. If set on the pick row, the
   *  reorder helper checks `relationship_bias.includes(curators_pick_priority)`
   *  as a secondary signal. Optional — the primary match is `id ===
   *  curators_pick_priority`. */
  readonly relationship_bias?: ReadonlyArray<string>;
};

/** Format — one of the 8 ship-with tribute formats. */
export type FormatShape = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Optional emoji / icon for the rich pill. */
  readonly icon?: string;
};

/** Theme — one of the 12 visual worlds, grouped under a category. */
export type ThemeShape = {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly icon?: string;
};

/** Theme category — emotional grouping for the 12 themes. */
export type ThemeCategoryShape = {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly description: string;
  readonly theme_ids: ReadonlyArray<string>;
};
