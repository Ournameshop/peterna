import 'server-only';

// Theme library — Phase 3 slice.
//
// Stage 3.3 of the spec presents 12 themes grouped in 6 emotional categories
// (`theme-categories.ts`). The `scene_description` field is the long-form
// directive injected verbatim into the Stage 3.5 combination-preview prompt
// and into every downstream storyboard frame in Phase 4+.
//
// Source YAML: spec `SKILL (5).md` §"themes" (line 1657). The 6 categories
// are sourced from `theme-categories.ts` and re-exported as `THEME_CATEGORIES`
// for back-compat with the Phase-0 `index.ts` barrel.

import { THEME_CATEGORIES, type ThemeCategoryId } from './theme-categories';

export { THEME_CATEGORIES };
export type { ThemeCategoryId };

export type ThemeId =
  | 'rainbow_bridge'
  | 'sunrise_reunion'
  | 'gentle_rain'
  | 'moonlight_vigil'
  | 'quiet_home'
  | 'beloved_places'
  | 'golden_meadow'
  | 'endless_shore'
  | 'forever_playful'
  | 'nap_champion'
  | 'starlit_reunion'
  | 'signs_and_symbols';

export type Theme = {
  readonly id: ThemeId;
  readonly label: string;
  /** Single-line subtitle shown beneath the label on the picker. */
  readonly secondary: string;
  /** Emoji used as the picker icon. */
  readonly icon: string;
  /** Long-form world description injected verbatim into combination-preview + storyboard prompts. */
  readonly scene_description: string;
  /** Parent category (id from `theme-categories.ts`). */
  readonly category: ThemeCategoryId;
  /** Palette tag — informational; consumed by Phase 4+ cinematography engine. */
  readonly palette: string;
  /** Lighting tag — informational; consumed by Phase 4+ cinematography engine. */
  readonly lighting: string;
};

export const THEMES: readonly Theme[] = [
  {
    id: 'rainbow_bridge',
    label: 'Rainbow Bridge',
    secondary: 'Soft cloudscapes, golden light, ethereal crossings.',
    icon: '🌈',
    scene_description:
      'Soft cloudscapes, golden light, ethereal crossings, pastel skies. A transcendent setting where the pet is bathed in warm light, surrounded by drifting soft clouds and gentle rainbow-tinted air. Reverent, hopeful, peaceful — the classic memorial visual language.',
    category: 'healing_and_peace',
    palette: 'pastel_warm',
    lighting: 'golden_diffuse',
  },
  {
    id: 'sunrise_reunion',
    label: 'Sunrise Reunion',
    secondary: 'Early-morning light, dew on grass, hopeful horizon.',
    icon: '🌅',
    scene_description:
      'Early-morning light, dew on grass, hopeful horizon, the new day breaking warm and gold — symbolic renewal. A gentle dawn setting with low warm sun, soft pink and gold sky, sparkling dew on a quiet field. The pet stands or sits comfortably in the new light.',
    category: 'healing_and_peace',
    palette: 'dawn_gold_rose',
    lighting: 'first_light',
  },
  {
    id: 'gentle_rain',
    label: 'Gentle Rain',
    secondary: 'Soft rain on windows, misty paths, space to be sad.',
    icon: '🌧️',
    scene_description:
      'Soft rain on windows, misty paths, puddles reflecting muted light, soft gray-blue skies — space for sadness, not forced positivity. The pet is sheltered, calm, watching the rain with a quiet contentment. Cool palette with warm interior light providing a gentle counterpoint.',
    category: 'quiet_grief',
    palette: 'cool_silver_blue',
    lighting: 'overcast_diffuse',
  },
  {
    id: 'moonlight_vigil',
    label: 'Moonlight Vigil',
    secondary: 'Soft moonlight, stars through trees, intimate calm.',
    icon: '🌙',
    scene_description:
      'Soft moonlight, stars through trees, nighttime calm, quiet companionship in the dark — intimate and reflective. The pet rests in the cool blue moonlight with a warm pinprick of distant lamp-light or hearth. The mood is reverent, still, and peaceful.',
    category: 'quiet_grief',
    palette: 'cool_blue_silver_warm_accents',
    lighting: 'moonlight_soft',
  },
  {
    id: 'quiet_home',
    label: 'Quiet Home',
    secondary: 'Warm interiors, sunbeams on hardwood, the favorite couch.',
    icon: '🛋️',
    scene_description:
      'Warm interiors, sunbeams on hardwood, the favorite couch, soft domestic light — the home you shared. The pet is at home in a recognizable lived-in space: a worn rug, a windowsill, the corner of a familiar room. Warm amber palette with a single window sunbeam doing the heavy lifting.',
    category: 'home_and_everyday_love',
    palette: 'warm_amber',
    lighting: 'window_sunbeam',
  },
  {
    id: 'beloved_places',
    label: 'Beloved Places',
    secondary: "Backyard, porch, park, beach — the actual world they loved.",
    icon: '🏡',
    scene_description:
      "Photoreal recreations of the pet's favorite spots — backyard, porch, park, beach, car. The actual world they loved, rendered with a soft natural palette and unforced real-world lighting. The frame feels like a beloved photograph from a real day, slightly warmer than memory.",
    category: 'home_and_everyday_love',
    palette: 'natural',
    lighting: 'real_world',
  },
  {
    id: 'golden_meadow',
    label: 'Golden Meadow',
    secondary: 'Sunlit fields, wildflowers, late-summer light.',
    icon: '☀️',
    scene_description:
      'Sunlit fields, wildflowers, slow-motion grasses, warm nostalgia, late-summer light. The pet moves through or rests in a wide open field at the magic hour — backlit grass, drifting pollen, an amber-green palette and a low warm sun behind. Joyful, unhurried, free.',
    category: 'nature_and_freedom',
    palette: 'amber_green',
    lighting: 'late_afternoon_sun',
  },
  {
    id: 'endless_shore',
    label: 'Endless Shore',
    secondary: 'Beach at sunset, pawprints in wet sand, peaceful goodbye.',
    icon: '🌊',
    scene_description:
      'Beach at sunset, pawprints in wet sand, waves washing gently in and away — peaceful goodbye. The pet stands or sits at the line where land meets sea, with gold-and-teal horizon light behind. Composition emphasizes calm, the gentle sweep of water, and the long view forward.',
    category: 'nature_and_freedom',
    palette: 'gold_teal_sand',
    lighting: 'sunset_horizon',
  },
  {
    id: 'forever_playful',
    label: 'Forever Playful',
    secondary: 'Tennis balls, zoomies, mid-bounce joyful energy.',
    icon: '🎾',
    scene_description:
      'Tennis balls, zoomies in open fields, mid-bounce joyful energy, ears flying, the toy in the air — pure aliveness. The pet is captured at the peak of joyful motion in bright warm midday light. Composition emphasizes energy, lift, and a single big smile-of-the-body moment.',
    category: 'their_personality',
    palette: 'bright_warm',
    lighting: 'midday_warm',
  },
  {
    id: 'nap_champion',
    label: 'Nap Champion',
    secondary: 'Soft blankets, sleepy warmth, the perfect curl-up spot.',
    icon: '🛏️',
    scene_description:
      'Soft blankets, sleepy warmth, the perfect curl-up spot, peaceful slow breathing, deep contentment. The pet is curled in a sun-warmed pile of blankets in a cozy domestic corner. Warm amber-cream palette, soft indoor light, the slow heavy stillness of a perfect nap.',
    category: 'their_personality',
    palette: 'cozy_amber_cream',
    lighting: 'soft_indoor_warm',
  },
  {
    id: 'starlit_reunion',
    label: 'Starlit Reunion',
    secondary: 'Celestial sky, gentle nebulas, soft cosmic companionship.',
    icon: '🌌',
    scene_description:
      'Celestial sky, gentle nebulas, a constellation subtly shaped like the pet, soft cosmic companionship. The pet sits in a meadow or on a quiet rise under a vast deep-blue-and-violet night sky shot through with warm-glow stars. Composition emphasizes scale and the comforting smallness of being held by something greater.',
    category: 'spiritual_and_symbolic',
    palette: 'deep_blue_violet_warm_glow',
    lighting: 'starlight',
  },
  {
    id: 'signs_and_symbols',
    label: 'Signs & Symbols',
    secondary: 'Butterflies, feathers, dragonflies — the visits we feel.',
    icon: '🦋',
    scene_description:
      'Butterflies, feathers drifting, dragonflies hovering, gentle symbolic encounters — the visits grieving owners often feel. The pet is calm and gently aware of a small natural sign nearby. Warm natural palette with iridescent accents, dappled warm light through leaves.',
    category: 'spiritual_and_symbolic',
    palette: 'warm_natural_with_iridescence',
    lighting: 'dappled_warm',
  },
] as const;

// -----------------------------------------------------------------------------
// Drift check: every theme's `category` must point at a real category, and
// every category's `theme_ids[]` must be a real theme.
// -----------------------------------------------------------------------------

const THEME_BY_ID = new Map<ThemeId, Theme>(THEMES.map((t) => [t.id, t]));

export function findTheme(id: ThemeId | string | null | undefined): Theme | undefined {
  if (!id) return undefined;
  return THEME_BY_ID.get(id as ThemeId);
}

const CATEGORY_IDS = new Set(THEME_CATEGORIES.map((c) => c.id));

// Eager drift assertion at module load. Skipped when `SKIP_LIBRARY_VALIDATION=1`
// so empty-scaffold-state Phase 0 can still boot.
function assertThemeCategoryAlignment(): void {
  const issues: string[] = [];
  for (const theme of THEMES) {
    if (!CATEGORY_IDS.has(theme.category)) {
      issues.push(`theme.${theme.id}.category=${theme.category} — unknown category id`);
    }
  }
  for (const category of THEME_CATEGORIES) {
    for (const tid of category.theme_ids) {
      if (!THEME_BY_ID.has(tid as ThemeId)) {
        issues.push(`theme_category.${category.id}.theme_ids contains unknown theme '${tid}'`);
      }
    }
  }
  if (issues.length === 0) return;
  const message = `Theme/category drift:\n${issues.map((i) => `  - ${i}`).join('\n')}`;
  if (process.env.SKIP_LIBRARY_VALIDATION === '1') {
    console.warn(`[library] ${message}`);
    return;
  }
  throw new Error(message);
}

assertThemeCategoryAlignment();
