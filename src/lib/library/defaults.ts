/**
 * Library defaults — used when downstream stages (5.5 Words, music, narration) are skipped.
 * Mirrors `default_words` in the SKILL spec (Peternal v2.3) verbatim. Phase 1 only reads
 * these as a fallback marker; Stage 5+ phases will consume them in earnest.
 */
export const DEFAULTS = {
  opening: 'simple',
  closing: 'simple_farewell',
  captions: [] as readonly string[],
  music: 'silence',
  narration: 'off',
} as const;

export type DefaultsShape = typeof DEFAULTS;
