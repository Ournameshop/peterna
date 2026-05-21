// Phase 5 — Music track library.
//
// Source-of-truth shape is here so both the Stage 5.5 picker (frontend) and
// the Stage 7 assembly (backend) agree on field names. Content mirrors the
// SKILL v2.3 spec §"music_tracks" (line ~2002) — paced for tribute use,
// gently filterable by theme + style.
//
// NOTE: the "do not modify — backend owns" rule for this file applies once
// the backend agent has shipped its own content. This module ships as a
// minimal seed so Phase 5 frontend can build green; when backend ships the
// real production library (with hosted audio + ElevenLabs IDs), it should
// overwrite this file. The shape contract here is the floor, not the ceiling.

import type { FormatId } from './formats';

export type MusicMood =
  | 'intimate'
  | 'hopeful'
  | 'warm'
  | 'reflective'
  | 'tender'
  | 'cinematic_warm'
  | 'ethereal'
  | 'pure'
  | 'celebratory'
  | 'melancholy';

export type MusicTrack = {
  readonly id: string;
  /** Title-case label shown on the picker pill. */
  readonly name: string;
  /** Single-line description shown beneath the label. */
  readonly description: string;
  /** Audio duration in seconds (0 = silent track). */
  readonly duration_s: number;
  readonly mood: MusicMood;
  /** Theme-category ids this track pairs well with. Used by the picker to surface a default. */
  readonly pairs_well_with: readonly string[];
  /** Art-style ids this track sits cleanly under. */
  readonly style_match: readonly string[];
  /** Format ids this track is a natural default for (drives Stage 5.5.4 default). */
  readonly format_affinity: readonly FormatId[];
};

export const MUSIC_TRACKS: readonly MusicTrack[] = [
  {
    id: 'soft_piano_01',
    name: 'Soft Piano',
    description: 'Solo piano, gentle, contemplative.',
    duration_s: 200,
    mood: 'intimate',
    pairs_well_with: ['home_and_everyday_love', 'healing_and_peace', 'quiet_grief'],
    style_match: ['watercolor', 'cinematic_realism', 'storybook_illustration'],
    format_affinity: ['letter_to_my_pet', 'day_in_the_life', 'send_off'],
  },
  {
    id: 'warm_cello_piano_01',
    name: 'Warm Cello & Piano',
    description: 'Duet of warm cello and piano, gentle build.',
    duration_s: 210,
    mood: 'hopeful',
    pairs_well_with: ['healing_and_peace', 'home_and_everyday_love', 'spiritual_and_symbolic'],
    style_match: ['cinematic_realism', 'watercolor'],
    format_affinity: ['biopic', 'send_off'],
  },
  {
    id: 'acoustic_guitar_01',
    name: 'Acoustic Guitar',
    description: 'Fingerpicked acoustic guitar, folk warmth.',
    duration_s: 195,
    mood: 'warm',
    pairs_well_with: ['home_and_everyday_love', 'their_personality', 'nature_and_freedom'],
    style_match: ['cinematic_realism', 'storybook_illustration'],
    format_affinity: ['day_in_the_life', 'greatest_hits', 'postcards_from'],
  },
  {
    id: 'ambient_strings_01',
    name: 'Ambient Strings',
    description: 'Slow ambient strings, no melody, atmospheric.',
    duration_s: 220,
    mood: 'reflective',
    pairs_well_with: ['quiet_grief', 'spiritual_and_symbolic', 'healing_and_peace'],
    style_match: ['watercolor', 'cinematic_realism'],
    format_affinity: ['send_off'],
  },
  {
    id: 'light_strings_01',
    name: 'Light Strings',
    description: 'Gently rising string quartet, hopeful arc.',
    duration_s: 200,
    mood: 'hopeful',
    pairs_well_with: ['healing_and_peace', 'their_personality', 'nature_and_freedom'],
    style_match: ['cinematic_realism', 'storybook_illustration'],
    format_affinity: ['forever_young', 'music_video'],
  },
  {
    id: 'music_box_01',
    name: 'Music Box',
    description: 'Soft music-box melody, childhood nostalgia.',
    duration_s: 180,
    mood: 'tender',
    pairs_well_with: ['their_personality', 'home_and_everyday_love'],
    style_match: ['storybook_illustration', 'watercolor'],
    format_affinity: ['biopic'],
  },
  {
    id: 'piano_strings_warm_01',
    name: 'Piano with Soft Strings',
    description: 'Piano lead, strings supporting, warm ensemble.',
    duration_s: 210,
    mood: 'cinematic_warm',
    pairs_well_with: ['healing_and_peace', 'nature_and_freedom', 'spiritual_and_symbolic'],
    style_match: ['cinematic_realism'],
    format_affinity: ['music_video'],
  },
  {
    id: 'ambient_pads_01',
    name: 'Ambient Pads',
    description: 'Soft synth pads, no rhythm, dream-like.',
    duration_s: 220,
    mood: 'ethereal',
    pairs_well_with: ['spiritual_and_symbolic', 'healing_and_peace', 'quiet_grief'],
    style_match: ['watercolor', 'cinematic_realism'],
    format_affinity: [],
  },
  {
    id: 'silence',
    name: 'No music — silence',
    description: 'No score. The ambient sound of each scene carries the tribute.',
    duration_s: 0,
    mood: 'pure',
    pairs_well_with: ['all'],
    style_match: ['all'],
    format_affinity: [],
  },
] as const;

const MUSIC_BY_ID = new Map<string, MusicTrack>(MUSIC_TRACKS.map((t) => [t.id, t]));

export function findMusicTrack(id: string | null | undefined): MusicTrack | undefined {
  if (!id) return undefined;
  return MUSIC_BY_ID.get(id);
}

/**
 * The picker's default selection — the first track whose `format_affinity`
 * includes the session's chosen format. Falls back to `null` (no music) when
 * no track matches; "silence" is its own opt-in pick rather than a sneaky
 * default.
 */
export function defaultMusicForFormat(formatId: string | null | undefined): string | null {
  if (!formatId) return null;
  const match = MUSIC_TRACKS.find((t) =>
    (t.format_affinity as readonly string[]).includes(formatId),
  );
  return match?.id ?? null;
}
