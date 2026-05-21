// Phase 5 — Closing title card archetypes.
//
// SKILL v2.3 §"closing_archetypes" (line ~1904). Same shape as opening
// archetypes — the picker UX is mirrored in the Stage 5.5.2 sub-stage.
// Default = "With love, always" per the v1.1 rule.

export type ClosingGroup =
  | 'peace'
  | 'bond'
  | 'reunion'
  | 'gratitude'
  | 'custom'
  | 'baseline';

export type ClosingArchetype = {
  readonly id: string;
  readonly name: string;
  readonly group: ClosingGroup;
  readonly template: string;
  readonly is_default?: boolean;
};

export const CLOSING_ARCHETYPES: readonly ClosingArchetype[] = [
  {
    id: 'with_love_always',
    name: 'With love, always',
    group: 'baseline',
    template: 'With love, always',
    is_default: true,
  },
  {
    id: 'peace_sleep_well',
    name: 'Sleep well, sweet boy/girl',
    group: 'peace',
    template: 'Sleep well, sweet [VOCATIVE_PLAIN].',
  },
  {
    id: 'peace_resting_now',
    name: 'Resting now',
    group: 'peace',
    template: 'Resting now.',
  },
  {
    id: 'bond_best_friend',
    name: 'My best friend',
    group: 'bond',
    template: 'My best friend.',
  },
  {
    id: 'bond_the_best',
    name: 'The best boy/girl',
    group: 'bond',
    template: 'The best [VOCATIVE_PLAIN].',
  },
  {
    id: 'reunion_until_we_meet',
    name: 'Until we meet again',
    group: 'reunion',
    template: 'Until we meet again, [PET_NAME].',
  },
  {
    id: 'reunion_wait_at_door',
    name: 'Wait for us at the door',
    group: 'reunion',
    template: 'Wait for us at the door, [VOCATIVE_GOOD].',
  },
  {
    id: 'gratitude_thank_you',
    name: 'Thank you for every good day',
    group: 'gratitude',
    template: 'Thank you for every good day.',
  },
  {
    id: 'gratitude_simple_farewell',
    name: 'Forever loved · [PET_NAME]',
    group: 'gratitude',
    template: 'Forever loved · [PET_NAME].',
  },
] as const;

/**
 * Resolves a closing archetype template for the WordsEditor pre-fill.
 * Substitutes [PET_NAME] only; gender placeholders flow through to the
 * backend's render-time resolver.
 */
export function resolveClosingArchetype(
  archetypeId: string | null | undefined,
  petName: string | null | undefined,
): string {
  const arch =
    CLOSING_ARCHETYPES.find((a) => a.id === archetypeId) ??
    CLOSING_ARCHETYPES.find((a) => a.is_default) ??
    CLOSING_ARCHETYPES[0];
  const name = petName && petName.trim().length > 0 ? petName.trim() : 'your pet';
  return arch.template.replace(/\[PET_NAME\]/g, name);
}

/** Default closing for the Stage 5.5.2 pre-fill — locked to "With love, always" per spec v1.1. */
export const DEFAULT_CLOSING_TEXT = 'With love, always';
