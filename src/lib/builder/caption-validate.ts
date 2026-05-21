// Caption validation — pure helpers shared between the BeatCard UI and the
// BuilderClient save handler.
//
// Per spec §"Caption length and safety (HARD)": every caption stays under
// 15 words. The model is instructed to respect this, but user edits may
// overrun. Our policy here is WARN-DON'T-BLOCK — the soft warning surfaces
// in the BeatCard inline; the PATCH still goes through with the user's
// chosen text. (A future Phase 4b "rewrite this beat" endpoint can offer
// to trim it for them.)

import type { BeatWire } from './wire-types';

/** Hard cap from the spec. Captions over this number trigger the soft warning. */
export const CAPTION_WORD_LIMIT = 15;

/**
 * Word count helper. Collapses Unicode whitespace and ignores empty splits.
 * Hyphens count as joining (e.g. "well-loved" is one word). Em-dashes split.
 */
export function countWords(s: string): number {
  if (!s) return 0;
  const trimmed = s.trim();
  if (trimmed.length === 0) return 0;
  // Split on whitespace or em-dash/en-dash. Treat hyphen-joined tokens as
  // a single word ("nine-year-old" = 1).
  const tokens = trimmed.split(/[\s—–]+/).filter(Boolean);
  return tokens.length;
}

export type BeatValidation = {
  /** True when the caption exceeds CAPTION_WORD_LIMIT — soft warning, not blocking. */
  caption_too_long?: boolean;
  /** Current word count, for the inline counter in the BeatCard. */
  caption_word_count: number;
};

/**
 * Validate a single beat. Returns the count + a soft-warning flag.
 * Never throws and never blocks — the UI uses the flag to surface a banner,
 * but the save still goes through.
 */
export function validateBeat(beat: BeatWire): BeatValidation {
  const count = countWords(beat.caption);
  return {
    caption_word_count: count,
    caption_too_long: count > CAPTION_WORD_LIMIT ? true : undefined,
  };
}
