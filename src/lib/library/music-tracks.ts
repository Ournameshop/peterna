// Music-track library — Phase 5 (Stage 5.5.4).
//
// Transcribed verbatim from the spec's embedded library YAML
// (`SKILL (5).md` §EMBEDDED ASSET LIBRARY → `music_tracks:`, line 2002).
//
// Phase 5 only stores the chosen `id` on the session row
// (`sessions.music_track_id`). Actual audio assembly happens at Phase 7
// (Stage 7.3 — see spec line 1188). No audio files are bundled here.
//
// Field-name convention follows the rest of the library — snake_case in the
// type and in any JSON that reaches the wire.

import type { ArtStyleId } from './art-styles';
import type { FormatId } from './formats';

export type MusicTrackId =
  | 'soft_piano_01'
  | 'warm_cello_piano_01'
  | 'acoustic_guitar_01'
  | 'ambient_strings_01'
  | 'light_strings_01'
  | 'music_box_01'
  | 'piano_strings_warm_01'
  | 'ambient_pads_01'
  | 'silence';

export type MusicMood =
  | 'intimate'
  | 'hopeful'
  | 'warm'
  | 'reflective'
  | 'tender'
  | 'cinematic_warm'
  | 'ethereal'
  | 'pure';

export type MusicTrack = {
  readonly id: MusicTrackId;
  /** Short pill label (e.g. "Soft Piano"). */
  readonly label: string;
  /** 1-line description shown beneath the label on the picker. */
  readonly secondary: string;
  /** Mood tag — used by Phase 5 filtering / labels. */
  readonly mood: MusicMood;
  /**
   * Loose duration hint in seconds. Informational only — the actual loop-edit
   * is a Phase-7 concern; the picker shows the value as a hint.
   */
  readonly duration_s: number;
  /**
   * Style IDs this track pairs well with. `'all'` is encoded as the full set
   * being absent — readers filter by intersection.
   */
  readonly style_match: ReadonlyArray<ArtStyleId | 'all'>;
  /**
   * Format IDs this track pairs well with. Phase 5 only uses this as a
   * surface hint; the chosen track persists regardless.
   */
  readonly format_affinity: ReadonlyArray<FormatId | 'all'>;
};

/**
 * Library content per spec YAML `music_tracks:` (line 2002–2070). Nine entries.
 *
 * `format_affinity` is derived from the YAML's `pairs_well_with` (themes)
 * collapsed to the formats most strongly aligned with those theme categories —
 * Phase 7 will re-derive the precise mapping once the theme→category index is
 * wired into the music selector.
 */
export const MUSIC_TRACKS: ReadonlyArray<MusicTrack> = [
  {
    id: 'soft_piano_01',
    label: 'Soft Piano',
    secondary: 'Solo piano, gentle, contemplative.',
    mood: 'intimate',
    duration_s: 200,
    style_match: ['watercolor', 'cinematic_realism', 'storybook_illustration'],
    format_affinity: ['letter_to_my_pet', 'send_off', 'day_in_the_life'],
  },
  {
    id: 'warm_cello_piano_01',
    label: 'Warm Cello & Piano',
    secondary: 'Duet of warm cello and piano, gentle build.',
    mood: 'hopeful',
    duration_s: 210,
    style_match: ['cinematic_realism', 'watercolor'],
    format_affinity: ['biopic', 'send_off', 'letter_to_my_pet'],
  },
  {
    id: 'acoustic_guitar_01',
    label: 'Acoustic Guitar',
    secondary: 'Fingerpicked acoustic guitar, folk warmth.',
    mood: 'warm',
    duration_s: 195,
    style_match: ['cinematic_realism', 'storybook_illustration'],
    format_affinity: ['day_in_the_life', 'greatest_hits', 'postcards_from'],
  },
  {
    id: 'ambient_strings_01',
    label: 'Ambient Strings',
    secondary: 'Slow ambient strings, no melody, atmospheric.',
    mood: 'reflective',
    duration_s: 220,
    style_match: ['watercolor', 'cinematic_realism'],
    format_affinity: ['send_off', 'letter_to_my_pet'],
  },
  {
    id: 'light_strings_01',
    label: 'Light Strings',
    secondary: 'Gently rising string quartet, hopeful arc.',
    mood: 'hopeful',
    duration_s: 200,
    style_match: ['cinematic_realism', 'storybook_illustration'],
    format_affinity: ['forever_young', 'biopic', 'postcards_from'],
  },
  {
    id: 'music_box_01',
    label: 'Music Box',
    secondary: 'Soft music-box melody, childhood nostalgia.',
    mood: 'tender',
    duration_s: 180,
    style_match: ['storybook_illustration', 'watercolor'],
    format_affinity: ['day_in_the_life', 'letter_to_my_pet'],
  },
  {
    id: 'piano_strings_warm_01',
    label: 'Piano with Soft Strings',
    secondary: 'Piano lead, strings supporting, warm ensemble.',
    mood: 'cinematic_warm',
    duration_s: 210,
    style_match: ['cinematic_realism'],
    format_affinity: ['biopic', 'send_off', 'forever_young'],
  },
  {
    id: 'ambient_pads_01',
    label: 'Ambient Pads',
    secondary: 'Soft synth pads, no rhythm, dream-like.',
    mood: 'ethereal',
    duration_s: 220,
    style_match: ['watercolor', 'cinematic_realism'],
    format_affinity: ['forever_young', 'send_off'],
  },
  {
    id: 'silence',
    label: 'Silence',
    secondary: 'No music — the in-clip ambient audio carries the tribute.',
    mood: 'pure',
    duration_s: 0,
    style_match: ['all'],
    format_affinity: ['all'],
  },
] as const;

const TRACK_BY_ID = new Map<MusicTrackId, MusicTrack>(
  MUSIC_TRACKS.map((t) => [t.id, t]),
);

export function findMusicTrack(
  id: MusicTrackId | string | null | undefined,
): MusicTrack | undefined {
  if (!id) return undefined;
  return TRACK_BY_ID.get(id as MusicTrackId);
}

/** First track ID whose `format_affinity` includes the given format, else null. */
export function defaultMusicForFormat(formatId: string | null | undefined): string | null {
  if (!formatId) return null;
  for (const t of MUSIC_TRACKS) {
    if (t.id === 'silence') continue;
    const affinity = t.format_affinity as readonly string[];
    if (affinity.includes('all') || affinity.includes(formatId)) return t.id;
  }
  return null;
}
