// Storyboard-frame prompt builder — Stage 5.
//
// Per spec `SKILL (5).md` §"Stage 5 — Storyboard" (line 882): one still frame
// per beat at gpt_image_2 `quality: medium`, 1k, in the session's
// `aspect_ratio`. The character sheet is the canonical likeness reference —
// passed as the SOLE `medias[]` entry — and the per-beat prompt is a
// compressed composition of the beat's scene description with the locked
// format / theme / style directives.
//
// Pure function: no I/O, no Date.now. Same input → same output.
//
// Structure (in order — matches the spec template at line 886):
//   1. Locked likeness-reference sentence (first line — see Phase 2 risk #1).
//   2. Beat label + scene description (the per-frame body).
//   3. Theme directive (the world the frame lives in).
//   4. Format context (the kind of tribute and how this beat composes).
//   5. Art-style directive (the visual register).
//   6. Composition / lighting note + aspect framing.
//   7. Hard exclusions (no humans, no illness, no text).
//   8. Refinements (only when present — from the reroll route).
//
// The per-frame prompt is intentionally smaller than the character-sheet
// prompt — the character sheet did the heavy descriptor lifting; here we
// rely on the reference image plus the beat's scene_description.

import type { ArtStyle } from '@/lib/library/art-styles';
import type { BeatWire, SessionWire } from '@/lib/builder/wire-types';
import type { Format } from '@/lib/library/formats';
import type { Theme } from '@/lib/library/themes';

import { type NormalizedAspect, normalizeAspect } from './build-preview';

/**
 * Locked verbatim per spec §"Likeness reference rule (HARD)" (line 172) and
 * `risk-register.md` Risk #1. The character sheet itself is the canonical
 * likeness — wording matches the Phase 3 combination-preview builder
 * ("the reference photo" — singular) because we pass exactly one reference.
 */
export const LIKENESS_REFERENCE_SENTENCE_TEMPLATE =
  'Replicate the exact likeness, markings, proportions, and distinguishing features of [PET_NAME] from the reference photo. Do not invent any other animal.';

/**
 * Hard exclusions appended to every prompt. Matches `build-character-sheet.ts`
 * and `build-preview.ts` so the safety contract is identical at every stage.
 */
export const HARD_EXCLUSIONS = [
  'No humans in frame.',
  'No medical equipment, no illness, no injury, no death, no distressing imagery — only living, peaceful, and dignified depictions.',
  'No text, no labels, no watermarks.',
];

export type BuildStoryboardFrameInput = {
  /** Session row (snake_case wire shape). Reads `pet_name`, `aspect_ratio`. */
  session: Pick<SessionWire, 'pet_name' | 'aspect_ratio'>;
  /** The beat this frame depicts. Provides `scene_description` and (informational) `archetype`. */
  beat: BeatWire;
  /** Chosen format (looked up by id in the route). Provides `visual_archetype`. */
  format: Format;
  /** Chosen theme (looked up by id in the route). Provides `scene_description`. */
  theme: Theme;
  /** Chosen art style (looked up by id in the route). Provides `directive`. */
  style: ArtStyle;
  /** S3 public URL of the locked `kind='character_sheet'` asset. The sole reference. */
  charSheetUrl: string;
  /** Optional user refinements appended to the prompt as a bullet list (reroll path only). */
  refinements?: string[];
};

export type BuildStoryboardFrameOutput = {
  prompt: string;
  references: Array<{ url: string; role: 'subject' }>;
};

export function buildStoryboardFramePrompt(
  input: BuildStoryboardFrameInput,
): BuildStoryboardFrameOutput {
  const petName = (input.session.pet_name ?? '').trim() || 'this pet';
  const aspect = normalizeAspect(input.session.aspect_ratio);
  const refinements = (input.refinements ?? []).map((r) => r.trim()).filter(Boolean);

  const likenessSentence = LIKENESS_REFERENCE_SENTENCE_TEMPLATE.replace(/\[PET_NAME\]/g, petName);

  const beatBlock = [
    `Beat #${input.beat.idx + 1} (${input.beat.archetype}).`,
    `Visual: ${input.beat.scene_description}`,
  ].join('\n');

  // Theme world + format context kept terse — the character sheet carries the
  // likeness load, and the beat description carries the scene specifics.
  const themeBlock = `Theme — ${input.theme.label}: ${input.theme.scene_description}`;
  const formatBlock = `Format context — ${input.format.label}: ${input.format.visual_archetype}`;

  const styleBlock = `Art style: ${input.style.directive}`;

  const composition = compositionForArchetype(input.beat.archetype);
  const framingBlock = `${composition} ${aspectFramingDirective(aspect)} Soft, warm, gentle lighting.`;

  const exclusions = HARD_EXCLUSIONS.join(' ');

  const sections: string[] = [
    likenessSentence,
    '',
    beatBlock,
    '',
    themeBlock,
    '',
    formatBlock,
    '',
    styleBlock,
    '',
    framingBlock,
    '',
    exclusions,
  ];

  if (refinements.length > 0) {
    sections.push('');
    sections.push('Apply these corrections to the previous render of this frame:');
    for (const r of refinements) {
      sections.push(`- ${r}`);
    }
  }

  const prompt = sections.join('\n').trim();

  const references: Array<{ url: string; role: 'subject' }> = [
    { url: input.charSheetUrl, role: 'subject' },
  ];

  return { prompt, references };
}

// ----------------------------------------------------------------------------
// Composition guidance per archetype.
//
// Spec line 896 ("Avoid extreme close-ups unless the beat is intimate ... Default
// to medium-wide for active beats, medium for relational beats, wide for
// establishing beats."). Mapping kept terse — the model picks the actual frame,
// we only hint the register.
// ----------------------------------------------------------------------------

function compositionForArchetype(archetype: string): string {
  switch (archetype) {
    case 'opening':
      return 'Composition: a wide establishing frame that introduces the subject in its world.';
    case 'closing':
      return 'Composition: a closing frame — quiet, balanced, the subject centered with breathing room.';
    case 'quiet_moment':
    case 'small_ritual':
      return 'Composition: a medium frame — intimate, close enough to read expression, not extreme close-up.';
    case 'peak_warmth':
      return 'Composition: a medium-wide frame at the emotional peak — the subject confidently centered, environment present but soft.';
    case 'descent':
    case 'second_turning':
    case 'first_turning':
      return 'Composition: a medium frame with a soft turning energy — gentle directional cue, not dramatic.';
    case 'rising':
    case 'mischief':
    case 'companionship':
      return 'Composition: a medium-wide active frame — the subject in motion or engaged with its world.';
    case 'season_change':
      return 'Composition: a wide environmental frame — the world shifts gently around the subject.';
    default:
      return 'Composition: a medium frame — the subject clearly read, environment soft and supportive.';
  }
}

function aspectFramingDirective(aspect: NormalizedAspect): string {
  switch (aspect) {
    case '9:16':
      return 'Vertical 9:16 framing.';
    case '16:9':
      return 'Horizontal 16:9 framing.';
    case '1:1':
      return 'Square 1:1 framing.';
  }
}
