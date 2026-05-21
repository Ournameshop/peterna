// Opening-archetype library — Phase 5 (Stage 5.5.1).
//
// Transcribed verbatim from the spec's embedded library YAML
// (`SKILL (5).md` §EMBEDDED ASSET LIBRARY → `opening_archetypes:`, line 1854).
//
// `template` strings carry placeholder tokens that resolve at presentation
// time using the pet's gender (via `PRONOUNS_AND_VOCATIVES`) and the user's
// captured `pet_name` / first selected trait. The picker UI shows the
// resolved text on each pill; the resolved text is what the user actually
// sees. The user's chosen text is written to
// `sessions.opening_title_card_text` and embedded into the Stage 5.6
// card-preview prompt — see `src/lib/prompts/build-card-preview.ts`.

export type OpeningArchetypeId =
  | 'simple'
  | 'identity_good'
  | 'identity_our_trait'
  | 'joy_filled_days'
  | 'joy_forever_trait'
  | 'love_beyond_measure'
  | 'love_thank_you'
  | 'love_forever_in_hearts'
  | 'custom';

export type OpeningArchetypeGroup =
  | 'baseline'
  | 'identity'
  | 'joy'
  | 'love'
  | 'custom';

export type OpeningArchetype = {
  readonly id: OpeningArchetypeId;
  /** Pill label shown on the picker (e.g. "Simple"). */
  readonly label: string;
  /** Emotional-register grouping; Stage 5.5.1 renders each group as its own section. */
  readonly group: OpeningArchetypeGroup;
  /**
   * Verbatim template string. `[PET_NAME]`, `[VOCATIVE_PLAIN]`,
   * `[TRAIT_ADJ]`, `[PRONOUN_SUBJECT]`, `[PRONOUN_SUBJECT_CAP]` and
   * `[USER_INPUT_LINE_1]` / `[USER_INPUT_LINE_2]` are the only allowed
   * placeholders — resolved by the UI before display and before persistence.
   */
  readonly template: string;
  /** Optional description shown under the pill for the baseline/custom rows. */
  readonly description?: string;
};

export const OPENING_ARCHETYPES: ReadonlyArray<OpeningArchetype> = [
  {
    id: 'simple',
    label: 'Simple',
    group: 'baseline',
    template: '[PET_NAME]',
    description: 'Just their name. The most minimal opening.',
  },
  {
    id: 'identity_good',
    label: 'A good [VOCATIVE_PLAIN], always',
    group: 'identity',
    template: '[PET_NAME]\nA good [VOCATIVE_PLAIN], always.',
  },
  {
    id: 'identity_our_trait',
    label: 'Our [TRAIT_ADJ] one',
    group: 'identity',
    template: '[PET_NAME]\nOur [TRAIT_ADJ] one.',
  },
  {
    id: 'joy_filled_days',
    label: '[PRONOUN_SUBJECT] filled every day with joy',
    group: 'joy',
    template: '[PET_NAME]\n[PRONOUN_SUBJECT_CAP] filled every day with joy.',
  },
  {
    id: 'joy_forever_trait',
    label: 'Forever [TRAIT_ADJ]',
    group: 'joy',
    template: '[PET_NAME]\nForever [TRAIT_ADJ].',
  },
  {
    id: 'love_beyond_measure',
    label: 'Loved beyond measure',
    group: 'love',
    template: '[PET_NAME]\nLoved beyond measure.',
  },
  {
    id: 'love_thank_you',
    label: 'Thank you for every good day',
    group: 'love',
    template: '[PET_NAME]\nThank you for every good day.',
  },
  {
    id: 'love_forever_in_hearts',
    label: 'Forever in our hearts',
    group: 'love',
    template: '[PET_NAME]\nForever in our hearts.',
  },
  {
    id: 'custom',
    label: 'Custom',
    group: 'custom',
    template: '[USER_INPUT_LINE_1]\n[USER_INPUT_LINE_2]',
    description: 'Write both lines yourself.',
  },
] as const;

const OPENING_BY_ID = new Map<OpeningArchetypeId, OpeningArchetype>(
  OPENING_ARCHETYPES.map((a) => [a.id, a]),
);

export function findOpeningArchetype(
  id: OpeningArchetypeId | string | null | undefined,
): OpeningArchetype | undefined {
  if (!id) return undefined;
  return OPENING_BY_ID.get(id as OpeningArchetypeId);
}

/**
 * Pick a sensible default opening archetype for the given format. Falls back
 * to the first non-custom archetype if none is format-specific. Returns the
 * full archetype object so callers can substitute placeholders themselves.
 */
export function defaultOpeningArchetypeForFormat(
  formatId: string | null | undefined,
): OpeningArchetype | null {
  if (!formatId) return OPENING_ARCHETYPES[0] ?? null;
  // Format-affinity heuristic: send_off + biopic → ceremonial; music_video +
  // greatest_hits → celebratory; everything else → warm/quiet.
  const ceremonial = ['send_off', 'biopic', 'forever_young'];
  const celebratory = ['music_video', 'greatest_hits'];
  if (ceremonial.includes(formatId)) {
    return (
      OPENING_ARCHETYPES.find((a) => /elegy|memoriam|tribute|loving/i.test(a.label)) ??
      OPENING_ARCHETYPES[0] ??
      null
    );
  }
  if (celebratory.includes(formatId)) {
    return (
      OPENING_ARCHETYPES.find((a) => /celebrat|joy|life/i.test(a.label)) ??
      OPENING_ARCHETYPES[0] ??
      null
    );
  }
  return OPENING_ARCHETYPES[0] ?? null;
}

/**
 * Substitute placeholders ([PET_NAME], [YEARS]) in an archetype template.
 * `years` may be null/undefined — empty string is substituted.
 */
export function resolveOpeningArchetype(
  archetype: OpeningArchetype | null | undefined,
  petName: string,
  years?: string | null,
): string {
  if (!archetype) return petName;
  return archetype.template
    .replace(/\[PET_NAME\]/g, petName)
    .replace(/\[YEARS\]/g, years ?? '')
    .replace(/\s+\n/g, '\n')
    .trim();
}
