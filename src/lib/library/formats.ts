import 'server-only';

// Format library — Phase 3 slice.
//
// Stage 3.2 of the spec (`SKILL (5).md` §"Stage 3 — Format, Theme & Style")
// presents 8 tribute formats. The `id`, `label`, `secondary`, and `icon`
// columns drive the picker UX; `visual_archetype` is the long-form directive
// injected into the Stage 3.5 combination preview prompt; `caption_voice` is
// the format-paired narration voice locked by the "Caption voice pairing
// matrix (HARD)" rule at spec line 240 (consumed in Phase 4+ beat-sheet and
// caption synthesis).
//
// Field-name convention follows the rest of the library: structural fields
// are snake_case to match the DB / wire format; TS member names use the same
// snake_case so the type and the YAML stay 1:1.

export type FormatId =
  | 'music_video'
  | 'biopic'
  | 'day_in_the_life'
  | 'letter_to_my_pet'
  | 'greatest_hits'
  | 'send_off'
  | 'postcards_from'
  | 'forever_young';

/**
 * Caption voice tag. Locked per spec's "Caption voice pairing matrix (HARD)"
 * (line 240). Each format has exactly one default voice; users may override
 * downstream but the picker does not surface the choice by default.
 */
export type CaptionVoice =
  | 'storybook_past_gentle'
  | 'storybook_past_life_stage'
  | 'first_person_owner_to_pet'
  | 'present_tense_narrator'
  | 'reverent_past_restrained'
  | 'first_person_from_pet'
  | 'storybook_celebratory'
  | 'lyric_fragment_optional';

export type Format = {
  readonly id: FormatId;
  /** Title-case label shown on the picker pill. */
  readonly label: string;
  /** Single-line subtitle shown beneath the label on the picker. */
  readonly secondary: string;
  /** Emoji used as the picker icon. */
  readonly icon: string;
  /** Long-form directive injected verbatim into combination-preview + storyboard prompts. */
  readonly visual_archetype: string;
  /** Locked narration voice (spec §"Caption voice pairing matrix"). Drives Phase 4+ caption synthesis. */
  readonly caption_voice: CaptionVoice;
  /** Beat counts this format is shaped for (informational; the length picker is independent). */
  readonly best_for_beat_count: readonly (8 | 12 | 16)[];
};

export const FORMATS: readonly Format[] = [
  {
    id: 'music_video',
    label: 'Music Video',
    secondary: 'Beats cut to musical structure, dynamic pacing, celebratory.',
    icon: '🎵',
    visual_archetype:
      'A music-video tribute: beats cut to an underlying musical structure, dynamic pacing, an emotionally rising arc from intro through verse and chorus to outro. Each frame reads as a single iconic moment that could anchor a chorus or a bridge — vivid, kinetic when joyful, contemplative when reflective. Composition favors confident framings that feel like album-cover stills.',
    caption_voice: 'lyric_fragment_optional',
    best_for_beat_count: [8, 12],
  },
  {
    id: 'biopic',
    label: 'Biopic',
    secondary: 'Chronological life story — puppy/kitten years to a tribute close.',
    icon: '📖',
    visual_archetype:
      'A chronological biopic of a beloved pet — the life remembered in order, from early days through prime adulthood into the golden years. The frame reads as a single chapter from that life story: contextual, time-of-life appropriate, with the soft warm grade of a remembered memory. Composition favors mid-shots that place the subject in a moment of their own history.',
    caption_voice: 'storybook_past_life_stage',
    best_for_beat_count: [12, 16],
  },
  {
    id: 'day_in_the_life',
    label: 'Day in the Life',
    secondary: 'A single perfect imagined day, gentle and present-tense.',
    icon: '☀️',
    visual_archetype:
      "A single perfect imagined day in this pet's life — a gentle, present-tense pacing through morning light, play, midday rest, evening, and quiet. The frame reads as one ordinary, profoundly loved moment from such a day: a sunbeam on hardwood, a favorite toy mid-bounce, a slow afternoon doze. Composition favors warm domestic intimacy.",
    caption_voice: 'storybook_past_gentle',
    best_for_beat_count: [8, 12, 16],
  },
  {
    id: 'letter_to_my_pet',
    label: 'Letter to My Pet',
    secondary: 'Voiceover-driven; each beat illustrates a line of a written letter.',
    icon: '✉️',
    visual_archetype:
      'An illustrated letter to a beloved pet — each frame is the visual companion to a single line of a heartfelt letter from owner to pet. The composition feels intimate and addressed, as if the camera itself is the page. Soft, close, contemplative; the pet is in their own world, the way they are remembered when the words are written.',
    caption_voice: 'first_person_owner_to_pet',
    best_for_beat_count: [8, 12],
  },
  {
    id: 'greatest_hits',
    label: 'Their Greatest Hits',
    secondary: 'Highlight reel of iconic moments and favorite things.',
    icon: '🏆',
    visual_archetype:
      "A highlight reel of this pet's most iconic moments — the favorite things, the recurring jokes of their life, the small everyday rituals that made them themselves. Each frame is one beloved vignette pulled into the light. Composition favors confident hero-shots: the pet, the favorite thing, joy.",
    caption_voice: 'storybook_celebratory',
    best_for_beat_count: [8, 12],
  },
  {
    id: 'send_off',
    label: 'The Send-Off',
    secondary: 'Ceremonial arc — journey, crossing, peace.',
    icon: '🕯️',
    visual_archetype:
      'A ceremonial send-off — a reverent arc from gathering through journey to a peaceful crossing and the quiet beyond. Composition is measured, symbolic, and restrained: thresholds, soft golden light, gentle paths, transcendent skies. The pet is composed, unafraid, and at ease in the frame. No grief imagery — only the dignified peace of a good goodbye.',
    caption_voice: 'reverent_past_restrained',
    best_for_beat_count: [12, 16],
  },
  {
    id: 'postcards_from',
    label: 'Postcards From [PET_NAME]',
    secondary: 'The pet "writes home" from where they are now.',
    icon: '📮',
    visual_archetype:
      'A series of imagined postcards from the pet — each frame is the photograph on the front of a postcard sent home from wherever they are now. The pet is the central subject, looking gently back toward the camera as if pausing mid-adventure to say hello. Composition favors slightly idealized landscapes — meadows, shorelines, gardens, golden hours — with the pet placed warmly within.',
    caption_voice: 'first_person_from_pet',
    best_for_beat_count: [8, 12, 16],
  },
  {
    id: 'forever_young',
    label: 'Forever Young',
    secondary: "Imagined alternate timelines — what they'd be doing if here.",
    icon: '✨',
    visual_archetype:
      'A "forever young" tribute — imagined alternate timelines and ongoing adventures of this pet, present-tense and joyful. The frame is one moment from a life that continues in spirit: a field, an ocean, a sunlit window, the favorite spot — the pet alive and at play in it. Composition favors light, motion, and openness; the energy is hopeful, never wistful.',
    caption_voice: 'present_tense_narrator',
    best_for_beat_count: [12, 16],
  },
] as const;

const FORMAT_BY_ID = new Map<FormatId, Format>(FORMATS.map((f) => [f.id, f]));

export function findFormat(id: FormatId | string | null | undefined): Format | undefined {
  if (!id) return undefined;
  return FORMAT_BY_ID.get(id as FormatId);
}
