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

/**
 * Phase 5 (Stage 5.5/5.6) literal-text fallbacks.
 *
 * Distinct from `DEFAULTS` above: `DEFAULTS` references library archetype IDs
 * (the v2.3 picker IDs) so the spec's `default_words` block round-trips
 * cleanly. `DEFAULT_WORDS` carries the resolved literal text that gets
 * written to `sessions.opening_title_card_text` / `closing_card_text` when
 * the user skips Stage 5.5 entirely — per spec line 1035 ("opening = pet
 * name, closing = 'With love, always'").
 *
 * `opening` is `null` here because the resolution depends on `pet_name`,
 * which only the route handler knows. The Words-approve route falls back to
 * `[pet_name] — [format.secondary]`; see `src/app/api/words/approve/route.ts`.
 */
export const DEFAULT_WORDS = {
  /**
   * `null` sentinel: the literal opening is computed from session context
   * (pet_name + format subtitle) at the approve step. Centralizing the
   * sentinel here keeps the route handler from string-literal-ing the rule
   * inline.
   */
  opening: null as null,
  closing: 'With love, always',
} as const;

export type DefaultWordsShape = typeof DEFAULT_WORDS;
