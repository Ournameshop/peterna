import 'server-only';

// Theme-category library — Phase 3 slice.
//
// Stage 3.3 of the spec presents themes in two taps: first the user picks one
// of 6 emotional categories (this file), then 2 themes inside that category
// (see `themes.ts`). Source YAML: spec §"theme_categories" (line 1625).
//
// Each category groups exactly 2 theme IDs from `THEMES`. The validator in
// `index.ts` does NOT cross-check these IDs against `themes.ts`; the cross-check
// happens at the `themeIdsByCategory` helper at the bottom of `themes.ts` so
// drift is caught at import time.

export type ThemeCategoryId =
  | 'healing_and_peace'
  | 'quiet_grief'
  | 'home_and_everyday_love'
  | 'nature_and_freedom'
  | 'their_personality'
  | 'spiritual_and_symbolic';

export type ThemeCategory = {
  readonly id: ThemeCategoryId;
  readonly label: string;
  readonly icon: string;
  readonly secondary: string;
  /** Member theme IDs (exactly 2 per category in the v1.0 library). */
  readonly theme_ids: readonly string[];
};

export const THEME_CATEGORIES: readonly ThemeCategory[] = [
  {
    id: 'healing_and_peace',
    label: 'Healing & Peace',
    icon: '🌅',
    secondary: 'Soft, hopeful, transcendent.',
    theme_ids: ['rainbow_bridge', 'sunrise_reunion'],
  },
  {
    id: 'quiet_grief',
    label: 'Quiet Grief',
    icon: '🌙',
    secondary: 'Gentle melancholy, space to be sad.',
    theme_ids: ['gentle_rain', 'moonlight_vigil'],
  },
  {
    id: 'home_and_everyday_love',
    label: 'Home & Everyday Love',
    icon: '🛋️',
    secondary: 'The warmth of ordinary moments.',
    theme_ids: ['quiet_home', 'beloved_places'],
  },
  {
    id: 'nature_and_freedom',
    label: 'Nature & Freedom',
    icon: '🌊',
    secondary: 'Open spaces, wind, release.',
    theme_ids: ['golden_meadow', 'endless_shore'],
  },
  {
    id: 'their_personality',
    label: 'Their Personality',
    icon: '🎾',
    secondary: 'Celebrate who they were, not how they left.',
    theme_ids: ['forever_playful', 'nap_champion'],
  },
  {
    id: 'spiritual_and_symbolic',
    label: 'Spiritual & Symbolic',
    icon: '🌌',
    secondary: 'Signs, stars, the unseen.',
    theme_ids: ['starlit_reunion', 'signs_and_symbols'],
  },
] as const;

const CATEGORY_BY_ID = new Map<ThemeCategoryId, ThemeCategory>(
  THEME_CATEGORIES.map((c) => [c.id, c]),
);

export function findThemeCategory(
  id: ThemeCategoryId | string | null | undefined,
): ThemeCategory | undefined {
  if (!id) return undefined;
  return CATEGORY_BY_ID.get(id as ThemeCategoryId);
}
