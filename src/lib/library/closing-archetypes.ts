// Closing-archetype library — Phase 5 (Stage 5.5.2).
//
// Transcribed verbatim from the spec's embedded library YAML
// (`SKILL (5).md` §EMBEDDED ASSET LIBRARY → `closing_archetypes:`, line 1904).
//
// The chosen template's resolved text is written to
// `sessions.closing_card_text` and embedded into the Stage 5.6 card-preview
// closing prompt — see `src/lib/prompts/build-card-preview.ts`. Placeholder
// resolution rules mirror `opening-archetypes.ts`.

export type ClosingArchetypeId =
  | 'peace_sleep_well'
  | 'peace_resting_now'
  | 'bond_best_friend'
  | 'bond_the_best'
  | 'reunion_until_we_meet'
  | 'reunion_wait_at_door'
  | 'gratitude_thank_you'
  | 'gratitude_simple_farewell'
  | 'custom';

export type ClosingArchetypeGroup =
  | 'peace'
  | 'bond'
  | 'reunion'
  | 'gratitude'
  | 'custom';

export type ClosingArchetype = {
  readonly id: ClosingArchetypeId;
  /** Pill label shown on the picker. */
  readonly label: string;
  /** Emotional-register grouping; Stage 5.5.2 renders each group as its own section. */
  readonly group: ClosingArchetypeGroup;
  /**
   * Verbatim template string. Allowed placeholders: `[PET_NAME]`,
   * `[VOCATIVE_PLAIN]`, `[VOCATIVE_GOOD]`, `[USER_INPUT]`. Resolved by the
   * UI before display and before persistence.
   */
  readonly template: string;
  /** Mark the default closing per the spec ("Forever loved · [PET_NAME]"). */
  readonly is_default?: boolean;
  /** Optional description shown under the pill for the custom row. */
  readonly description?: string;
};

export const CLOSING_ARCHETYPES: ReadonlyArray<ClosingArchetype> = [
  {
    id: 'peace_sleep_well',
    label: 'Sleep well, sweet [VOCATIVE_PLAIN]',
    group: 'peace',
    template: 'Sleep well, sweet [VOCATIVE_PLAIN].',
  },
  {
    id: 'peace_resting_now',
    label: 'Resting now',
    group: 'peace',
    template: 'Resting now.',
  },
  {
    id: 'bond_best_friend',
    label: 'My best friend',
    group: 'bond',
    template: 'My best friend.',
  },
  {
    id: 'bond_the_best',
    label: 'The best [VOCATIVE_PLAIN]',
    group: 'bond',
    template: 'The best [VOCATIVE_PLAIN].',
  },
  {
    id: 'reunion_until_we_meet',
    label: 'Until we meet again, [PET_NAME]',
    group: 'reunion',
    template: 'Until we meet again, [PET_NAME].',
  },
  {
    id: 'reunion_wait_at_door',
    label: 'Wait for us at the door, [VOCATIVE_GOOD]',
    group: 'reunion',
    template: 'Wait for us at the door, [VOCATIVE_GOOD].',
  },
  {
    id: 'gratitude_thank_you',
    label: 'Thank you for every good day',
    group: 'gratitude',
    template: 'Thank you for every good day.',
  },
  {
    id: 'gratitude_simple_farewell',
    label: 'Forever loved · [PET_NAME]',
    group: 'gratitude',
    template: 'Forever loved · [PET_NAME].',
    is_default: true,
  },
  {
    id: 'custom',
    label: 'Custom',
    group: 'custom',
    template: '[USER_INPUT]',
    description: 'Write it yourself.',
  },
] as const;

const CLOSING_BY_ID = new Map<ClosingArchetypeId, ClosingArchetype>(
  CLOSING_ARCHETYPES.map((a) => [a.id, a]),
);

export function findClosingArchetype(
  id: ClosingArchetypeId | string | null | undefined,
): ClosingArchetype | undefined {
  if (!id) return undefined;
  return CLOSING_BY_ID.get(id as ClosingArchetypeId);
}

/** Default closing card text used when the user doesn't enter one. */
export const DEFAULT_CLOSING_TEXT = 'With love, always';
