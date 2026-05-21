// Caption template library — Phase 4a (Stage 4 beat sheet).
//
// Per spec § "caption_templates", each beat archetype carries 2–4 suggested
// phrasings the model can draw on. The model is free to write new captions
// — these are inspiration, not constraints — but having archetype-paired
// reference phrasings keeps the output grounded in the spec's emotional arc.
//
// Caption voice (first-person owner-to-pet vs. third-person narrator vs.
// pet-as-narrator) is selected per format in `formats.ts::caption_voice` and
// applied at prompt-build time. These templates are voice-agnostic — use
// "[pet]" as a placeholder the prompt builder substitutes.

export type BeatArchetypeId =
  | 'opening'
  | 'rising'
  | 'first_turning'
  | 'peak_warmth'
  | 'second_turning'
  | 'quiet_moment'
  | 'descent'
  | 'closing';

export type CaptionTemplate = {
  readonly archetype: BeatArchetypeId;
  readonly suggestions: readonly string[];
};

export const CAPTION_TEMPLATES: readonly CaptionTemplate[] = [
  {
    archetype: 'opening',
    suggestions: [
      'This is where the story begins.',
      'The morning light. The first breath.',
      'Once, there was a small soul who loved everything.',
      'Before all the years — there was this.',
    ],
  },
  {
    archetype: 'rising',
    suggestions: [
      'And then the world opened up.',
      'Everything was new and worth chasing.',
      '[pet] discovered the sky was something to bark at.',
      'Days stretched longer. Joy moved faster.',
    ],
  },
  {
    archetype: 'first_turning',
    suggestions: [
      'Something shifted that summer.',
      'A favorite spot. A favorite person.',
      'The world narrowed to the things that mattered.',
      'Love found its shape.',
    ],
  },
  {
    archetype: 'peak_warmth',
    suggestions: [
      'These were the years.',
      'Sunlight on fur. Time that didn’t move.',
      'If there was a heaven, it looked like this.',
      'Everything was enough.',
    ],
  },
  {
    archetype: 'second_turning',
    suggestions: [
      'Slower mornings. Softer light.',
      'The world began to ask for less.',
      'Steps shortened. The quiet grew familiar.',
      'Stillness became its own kind of joy.',
    ],
  },
  {
    archetype: 'quiet_moment',
    suggestions: [
      'Just being together was enough.',
      'A nap. A breath. A heartbeat shared.',
      'No words needed — only this.',
      'Time held them, gently.',
    ],
  },
  {
    archetype: 'descent',
    suggestions: [
      'The light softened.',
      'Some goodbyes are slow, and full of love.',
      'A hand on warm fur. A promise without words.',
      'It was almost time.',
    ],
  },
  {
    archetype: 'closing',
    suggestions: [
      'With love, always.',
      'The story ends here, but the love does not.',
      'Run free, sweet one.',
      'You are still everywhere I look.',
    ],
  },
] as const;

/**
 * Templates for the 12-beat extension — adds 4 archetype variants beyond the
 * core 8. Used when `beat_count === 12 || beat_count === 16`.
 */
export type ExtendedArchetypeId =
  | 'mischief'
  | 'companionship'
  | 'season_change'
  | 'small_ritual';

export const EXTENDED_CAPTION_TEMPLATES: ReadonlyArray<{
  readonly archetype: ExtendedArchetypeId;
  readonly suggestions: readonly string[];
}> = [
  {
    archetype: 'mischief',
    suggestions: [
      'Some habits never broke.',
      'Stolen socks. Counter-surfed sandwiches.',
      '[pet] kept their reputation alive.',
      'Not every memory needed to be solemn.',
    ],
  },
  {
    archetype: 'companionship',
    suggestions: [
      'They were there for everything.',
      'Through every season — the same warm presence.',
      'You were never really alone.',
      'Some friendships need no language.',
    ],
  },
  {
    archetype: 'season_change',
    suggestions: [
      'Autumn always smelled different to them.',
      'The first snow. The first thaw.',
      'Years marked by the weather, not the calendar.',
      'Each season carried its own small joy.',
    ],
  },
  {
    archetype: 'small_ritual',
    suggestions: [
      'The same path. The same time. The same look back.',
      'Tea in the morning. A nap by 2pm.',
      'Routines that became sacred.',
      'Love often hides in small repeated things.',
    ],
  },
] as const;

/**
 * Get the suggestion bank for a given archetype (core or extended). Returns
 * an empty array if the archetype isn't in either library — the prompt builder
 * treats unknown archetypes as "model-generated only, no template hints."
 */
export function captionSuggestionsFor(archetype: string): readonly string[] {
  const core = CAPTION_TEMPLATES.find((t) => t.archetype === archetype);
  if (core) return core.suggestions;
  const ext = EXTENDED_CAPTION_TEMPLATES.find((t) => t.archetype === archetype);
  return ext?.suggestions ?? [];
}
