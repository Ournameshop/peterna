import 'server-only';

// Curator's Picks library — Phase 3 slice.
//
// Stage 3.1 of the spec presents 4 (now 6) one-tap presets at the top of the
// format screen. Each preset locks a format + theme + style triple. Picks are
// reordered per the user's relationship at Stage 1.7 via `curators_pick_priority`
// on the relationship row (see `relationships.ts`).
//
// Source YAML: spec `SKILL (5).md` §"curators_picks" (line 1800), plus the v1.3
// memorial additions documented at spec lines 85-86. The memorial picks
// (`quiet_remembrance`, `forever_in_stone`) reference Phase-4+ caption containers
// and music presets which are not yet in the library; the format/theme/style
// triple still locks cleanly and that's what Stage 3 needs.

import type { ArtStyleId } from './art-styles';
import type { FormatId } from './formats';
import type { RelationshipId } from './relationships';
import type { ThemeId } from './themes';

export type CuratorsPickId =
  | 'classic_send_off'
  | 'joyful_celebration'
  | 'quiet_goodbye'
  | 'storybook_for_them'
  | 'quiet_remembrance'
  | 'forever_in_stone';

export type CuratorsPick = {
  readonly id: CuratorsPickId;
  /** Title-case label shown on the pick card. */
  readonly label: string;
  /** Single-line tagline shown beneath the label. */
  readonly secondary: string;
  readonly format_id: FormatId;
  readonly theme_id: ThemeId;
  readonly style_id: ArtStyleId;
  /**
   * Relationships this pick is biased toward — used by the picker to surface
   * the pick at position #1 when the user's relationship matches. See
   * `relationships.ts` for the canonical bias mapping (this is the inverse
   * lookup; the picker can compute either direction).
   */
  readonly relationship_bias: readonly RelationshipId[];
  /**
   * v1.3 memorial picks reference a caption container that ships in Phase 4+.
   * Captured here so the upgrade path is documented; Stage 3 ignores it.
   */
  readonly memorial_container_id?: string;
};

export const CURATORS_PICKS: readonly CuratorsPick[] = [
  {
    id: 'classic_send_off',
    label: 'The Classic Send-Off',
    secondary: 'A traditional, ceremonial goodbye.',
    format_id: 'send_off',
    theme_id: 'rainbow_bridge',
    style_id: 'cinematic_realism',
    relationship_bias: ['always_mine', 'unspecified'],
  },
  {
    id: 'joyful_celebration',
    label: 'Joyful Celebration',
    secondary: 'Their best moments, sun-drenched and warm.',
    format_id: 'greatest_hits',
    theme_id: 'golden_meadow',
    style_id: 'cinematic_realism',
    relationship_bias: ['family_first'],
  },
  {
    id: 'quiet_goodbye',
    label: 'The Quiet Goodbye',
    secondary: 'An intimate letter, in the home you shared.',
    format_id: 'letter_to_my_pet',
    theme_id: 'quiet_home',
    style_id: 'watercolor',
    relationship_bias: ['partnership', 'companion_through_grief', 'rescue_last_chapter'],
  },
  {
    id: 'storybook_for_them',
    label: 'A Storybook for [PET_NAME]',
    secondary: 'Their life, painted like a beloved picture book.',
    format_id: 'biopic',
    theme_id: 'beloved_places',
    style_id: 'storybook_illustration',
    relationship_bias: ['childhood'],
  },
  // v1.3 memorial picks. Containers + music wire in Phase 4+; the
  // format/theme/style triple is what Stage 3 needs.
  {
    id: 'quiet_remembrance',
    label: 'Quiet Remembrance',
    secondary: 'A watercolor keepsake, soft as a pressed flower.',
    format_id: 'letter_to_my_pet',
    theme_id: 'signs_and_symbols',
    style_id: 'watercolor',
    relationship_bias: ['companion_through_grief', 'partnership'],
    memorial_container_id: 'pressed_flower_bookmark',
  },
  {
    id: 'forever_in_stone',
    label: 'Forever in Stone',
    secondary: 'A cinematic remembrance of the places they loved.',
    format_id: 'send_off',
    theme_id: 'beloved_places',
    style_id: 'cinematic_realism',
    relationship_bias: ['always_mine', 'rescue_last_chapter'],
    memorial_container_id: 'engraved_stone_plaque',
  },
] as const;

const PICK_BY_ID = new Map<CuratorsPickId, CuratorsPick>(
  CURATORS_PICKS.map((p) => [p.id, p]),
);

export function findCuratorsPick(
  id: CuratorsPickId | string | null | undefined,
): CuratorsPick | undefined {
  if (!id) return undefined;
  return PICK_BY_ID.get(id as CuratorsPickId);
}
