// Phase 5 — Opening title card archetypes.
//
// SKILL v2.3 §"opening_archetypes" (line ~1854). The Stage 5.5.1 picker
// presents these grouped by emotional register. The frontend reads the
// templates and substitutes [PET_NAME] into a sensible default for the
// pre-filled TextField in the WordsEditor.

export type OpeningGroup = 'baseline' | 'identity' | 'joy' | 'love' | 'custom';

export type OpeningArchetype = {
  readonly id: string;
  readonly name: string;
  readonly group: OpeningGroup;
  /** Template with [PET_NAME] / [VOCATIVE_PLAIN] / [TRAIT_ADJ] / [PRONOUN_*] placeholders. */
  readonly template: string;
  readonly is_default?: boolean;
  readonly description?: string;
};

export const OPENING_ARCHETYPES: readonly OpeningArchetype[] = [
  {
    id: 'simple',
    name: 'Simple',
    group: 'baseline',
    template: '[PET_NAME]',
    is_default: true,
    description: 'Just their name. The most minimal opening.',
  },
  {
    id: 'identity_good',
    name: 'A good boy/girl, always',
    group: 'identity',
    template: '[PET_NAME]\nA good [VOCATIVE_PLAIN], always.',
  },
  {
    id: 'identity_our_trait',
    name: 'Our [TRAIT_ADJ] one',
    group: 'identity',
    template: '[PET_NAME]\nOur [TRAIT_ADJ] one.',
  },
  {
    id: 'joy_filled_days',
    name: 'They filled every day with joy',
    group: 'joy',
    template: '[PET_NAME]\n[PRONOUN_SUBJECT_CAP] filled every day with joy.',
  },
  {
    id: 'joy_forever_trait',
    name: 'Forever [TRAIT_ADJ]',
    group: 'joy',
    template: '[PET_NAME]\nForever [TRAIT_ADJ].',
  },
  {
    id: 'love_beyond_measure',
    name: 'Loved beyond measure',
    group: 'love',
    template: '[PET_NAME]\nLoved beyond measure.',
  },
  {
    id: 'love_thank_you',
    name: 'Thank you for every good day',
    group: 'love',
    template: '[PET_NAME]\nThank you for every good day.',
  },
  {
    id: 'love_forever_in_hearts',
    name: 'Forever in our hearts',
    group: 'love',
    template: '[PET_NAME]\nForever in our hearts.',
  },
] as const;

/**
 * Resolves an archetype template for the WordsEditor's pre-fill. Only
 * substitutes [PET_NAME] — gender/trait placeholders survive into the
 * backend's render-time resolver, which has the full pronoun + trait table.
 *
 * Returns a sensible default ("[NAME]\nForever in our hearts.") when no
 * archetype id is supplied, so the editor never lands on an empty value.
 */
export function resolveOpeningArchetype(
  archetypeId: string | null | undefined,
  petName: string | null | undefined,
): string {
  const arch =
    OPENING_ARCHETYPES.find((a) => a.id === archetypeId) ??
    OPENING_ARCHETYPES.find((a) => a.is_default) ??
    OPENING_ARCHETYPES[0];
  const name = petName && petName.trim().length > 0 ? petName.trim() : 'Your pet';
  return arch.template.replace(/\[PET_NAME\]/g, name);
}

/**
 * The format-driven default archetype id for the Stage 5.5.1 pre-fill.
 * For now every format defaults to `simple` (just the pet's name); the
 * backend's prompt builder can override per-format if needed.
 */
export function defaultOpeningArchetypeForFormat(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formatId: string | null | undefined,
): string {
  return 'simple';
}
