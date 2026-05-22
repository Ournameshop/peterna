// Video-clip prompt builder — Stage 6.
//
// Pure function: given a beat, the cinematography brief for that beat, the
// session's locked format/theme/style, the pet name, the aspect ratio, and
// the storyboard frame URL — return the Seedance 2.0 prompt + the start
// image URL + duration + aspect ratio.
//
// Spec source: `SKILL (5).md` §"Stage 6 — Generation" (line 1131) +
// §"Engine output" cinematography brief (line 68). The brief from Stage 5.7
// is the source of truth for all motion / lens / lighting / DOF / shot
// structure / audio decisions. We translate each brief field into the
// Seedance prompt language defined by the spec's prompt template at
// line 1150.
//
// Structure (in order — matches the spec template at line 1150):
//   1. Likeness reference sentence (same wording as Stage 5 storyboard).
//   2. Beat visual description + theme description + brief description.
//   3. Audio line (ambient only — music and narration are mixed at Stage 7).
//   4. Camera line — motion + lens + lighting motion + DOF + shot structure.
//   5. Duration / aspect / soft warm grade / hard exclusions.
//   6. Art-style directive (consistent across all clips).
//
// 15-second clips, audio ON, 1080p — all locked by the spec. The route
// passes the resulting `durationSeconds` and `aspectRatio` to the vendor.

import type { ArtStyle } from '@/lib/library/art-styles';
import type {
  BeatWire,
  MotionBriefWire,
  SessionWire,
} from '@/lib/builder/wire-types';
import type { Format } from '@/lib/library/formats';
import type { Theme } from '@/lib/library/themes';

import { type NormalizedAspect, normalizeAspect } from './build-preview';

/**
 * Locked verbatim — same likeness rule used at Stages 2, 3.5, and 5. The
 * storyboard frame itself is the canonical likeness anchor; the storyboard
 * was rendered with the character sheet as a reference, so the chain
 * preserves identity all the way to motion.
 */
export const LIKENESS_REFERENCE_SENTENCE_TEMPLATE =
  'Replicate the exact likeness, markings, proportions, and distinguishing features of [PET_NAME] from the start image. Do not invent any other animal.';

/**
 * Hard exclusions — match the storyboard / card-preview builders. Stage 6
 * shouldn't generate text in-frame either; the title and closing cards live
 * in Stage 7 assembly, not the Seedance render.
 */
export const HARD_EXCLUSIONS = [
  'No humans in frame.',
  'No medical equipment, no illness, no injury, no death, no distressing imagery — only living, peaceful, dignified, transcendent presence.',
  'No text, no labels, no watermarks, no captions burned into the frame.',
  'No fast cuts, no shaky cam, no whip pans, no aggressive motion.',
];

export type BuildVideoClipInput = {
  /** Session row (snake_case wire shape). Reads `pet_name`, `aspect_ratio`. */
  session: Pick<SessionWire, 'pet_name' | 'aspect_ratio'>;
  /** The beat this clip depicts — supplies `scene_description` and `archetype`. */
  beat: BeatWire;
  /** Approved motion brief for this beat (from Stage 5.7 cinematography engine). */
  brief: MotionBriefWire;
  /** Chosen format — provides `visual_archetype`. */
  format: Format;
  /** Chosen theme — provides `scene_description`. */
  theme: Theme;
  /** Chosen art style — provides `directive`. */
  style: ArtStyle;
  /** S3 public URL of the approved `kind='storyboard_frame'` asset for this beat. */
  storyboardFrameUrl: string;
  /**
   * Phase 15a — optional seed-photo override. When set, the builder uses this
   * URL as the Seedance `image_url` instead of the storyboard frame. The
   * storyboard frame is still referenced as a likeness anchor inside the prompt
   * body ("Maintain the look established in the reference frame.") so identity
   * doesn't drift. Only fires on memory/companionship/turning archetypes when
   * the session has at least one with_human photo (see selectSeedPhotoForBeat).
   */
  seedPhotoOverrideUrl?: string;
};

/**
 * Beat archetypes that get the with_human seed-photo override when an
 * appropriate photo exists. Kept as a `Set` lookup so the selector is O(1)
 * and the list is the single source of truth for the override rule.
 */
export const WITH_HUMAN_OVERRIDE_ARCHETYPES: ReadonlySet<string> = new Set([
  'peak_warmth',
  'companionship',
  'turning',
]);

/**
 * Round-robin selector for the with_human image-to-video seed. Returns the
 * next photo URL for a given beat_idx so the override URLs vary across the
 * tribute's memory beats instead of all reusing the same photo. Pure function
 * — same `(beatIdx, photos)` always picks the same URL, so retries with the
 * same idempotency key produce the same prompt.
 *
 * Returns `null` when the beat's archetype isn't in the override set OR when
 * there are no with_human photos available. Callers fall back to the
 * storyboard frame on `null`.
 */
export function selectSeedPhotoForBeat(input: {
  beatIdx: number;
  archetype: string;
  withHumanPhotoUrls: ReadonlyArray<string>;
}): string | null {
  if (!WITH_HUMAN_OVERRIDE_ARCHETYPES.has(input.archetype)) return null;
  if (input.withHumanPhotoUrls.length === 0) return null;
  // Round-robin by beat_idx. Modulo over the photo array length keeps the
  // selection deterministic and bounded.
  const i = ((input.beatIdx % input.withHumanPhotoUrls.length) + input.withHumanPhotoUrls.length) %
    input.withHumanPhotoUrls.length;
  return input.withHumanPhotoUrls[i] ?? null;
}

export type BuildVideoClipOutput = {
  prompt: string;
  imageUrl: string;
  durationSeconds: 15;
  aspectRatio: NormalizedAspect;
};

export function buildVideoClipPrompt(input: BuildVideoClipInput): BuildVideoClipOutput {
  const petName = (input.session.pet_name ?? '').trim() || 'this pet';
  const aspect = normalizeAspect(input.session.aspect_ratio);
  const brief = input.brief;

  // Phase 15a — when a with_human seed override is in play, Seedance animates
  // a real photo of pet+person instead of the rendered storyboard frame. We
  // still pin the storyboard frame inside the prompt body as a likeness
  // anchor so the model doesn't drift the pet's identity toward whatever
  // pet happens to be in the with_human photo angle.
  const usingOverride = Boolean(input.seedPhotoOverrideUrl);
  const seedImageUrl = input.seedPhotoOverrideUrl ?? input.storyboardFrameUrl;

  const likenessSentence = LIKENESS_REFERENCE_SENTENCE_TEMPLATE.replace(
    /\[PET_NAME\]/g,
    petName,
  );

  const beatBlock = [
    `Beat #${input.beat.idx + 1} (${input.beat.archetype}).`,
    `Visual: ${input.beat.scene_description}`,
  ].join('\n');

  const themeBlock = `Theme — ${input.theme.label}: ${input.theme.scene_description}`;
  const formatBlock = `Format context — ${input.format.label}: ${input.format.visual_archetype}`;

  const audioLine = audioLineFor(brief);
  const cameraLine = cameraLineFor(brief, aspect);
  const styleBlock = `Art style: ${input.style.directive}. Apply consistently across all clips in this tribute.`;

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
    audioLine,
    '',
    cameraLine,
    '',
    styleBlock,
    '',
    exclusions,
  ];

  if (usingOverride) {
    // Likeness anchor sentence — the storyboard frame still defines the
    // canonical look of the pet; the override only changes the starting
    // frame Seedance animates from. We append the anchor as a tail line so
    // the locked likeness sentence stays at position 0.
    sections.push('');
    sections.push(
      'Animate the start image directly. Maintain the look established in the storyboard reference for the pet — markings, proportions, and distinguishing features stay exactly as rendered. Do not alter the human in the frame; gently animate breathing and small natural motion only.',
    );
  }

  return {
    prompt: sections.join('\n').trim(),
    imageUrl: seedImageUrl,
    durationSeconds: 15,
    aspectRatio: aspect,
  };
}

// -----------------------------------------------------------------------------
// Brief → Seedance prompt translation.
//
// Each helper here is small and self-explanatory. The translations follow the
// spec's prompt template at line 1150 — keep wording stable so prompt-tuning
// is reproducible.
// -----------------------------------------------------------------------------

function audioLineFor(brief: MotionBriefWire): string {
  const ambient = ambientDescriptor(brief.ambient_audio);
  const intensity = audioIntensityDescriptor(brief.audio_intensity);
  return `Audio: ${ambient}, ${intensity}. No music in clip. No dialogue. No echo or doubling.`;
}

function cameraLineFor(brief: MotionBriefWire, aspect: NormalizedAspect): string {
  const move = cameraMoveDescriptor(brief.camera_move, brief.move_intensity);
  const lens = lensDescriptor(brief.lens_mm, brief.lens_character);
  const lighting = lightingMotionDescriptor(brief.lighting_motion);
  const dof = dofDescriptor(brief.dof_behavior);
  const shot = shotStructureDescriptor(brief.shot_structure);
  const subject = subjectMotionDescriptor(brief.subject_motion);
  const aspectFraming = aspectFramingDirective(aspect);
  return [
    `Camera: ${move}.`,
    `Lens: ${lens}.`,
    `Subject motion: ${subject}.`,
    `Lighting motion: ${lighting}.`,
    `Depth of field: ${dof}.`,
    `Shot structure: ${shot}.`,
    `Duration: 15 seconds.`,
    aspectFraming,
    `Soft, warm color grade. Gentle, dignified, transcendent register.`,
  ].join(' ');
}

function cameraMoveDescriptor(
  move: MotionBriefWire['camera_move'],
  intensity: MotionBriefWire['move_intensity'],
): string {
  const intensityWord =
    intensity === 'barely_perceptible'
      ? 'barely perceptible'
      : intensity === 'gentle'
        ? 'gentle'
        : 'pronounced but never aggressive';
  switch (move) {
    case 'locked_off':
      return `locked off — no camera motion, ${intensityWord} stillness`;
    case 'slow_push':
      return `slow push toward the subject with ${intensityWord} intensity`;
    case 'slow_pull':
      return `slow pull away from the subject with ${intensityWord} intensity`;
    case 'slow_rise':
      return `slow vertical rise with ${intensityWord} intensity`;
    case 'slow_fall':
      return `slow vertical fall with ${intensityWord} intensity`;
    case 'slow_pan_L':
      return `slow pan to the left with ${intensityWord} intensity`;
    case 'slow_pan_R':
      return `slow pan to the right with ${intensityWord} intensity`;
    case 'slow_orbit':
      return `slow orbit around the subject with ${intensityWord} intensity`;
    case 'parallax_dolly':
      return `slow parallax dolly revealing foreground and background depth, ${intensityWord} intensity`;
    case 'handheld_float':
      return `gentle handheld float with subtle breathing, ${intensityWord} intensity, never shaky`;
    case 'dreamy_drift':
      return `dreamy floating drift across the scene with ${intensityWord} intensity`;
  }
}

function lensDescriptor(
  mm: MotionBriefWire['lens_mm'],
  character: MotionBriefWire['lens_character'],
): string {
  switch (character) {
    case 'wide_establishing':
      return `${mm}mm wide establishing — open, environmental`;
    case 'standard':
      return `${mm}mm standard — natural perspective`;
    case 'portrait':
      return `${mm}mm portrait — intimate, subject-anchored`;
    case 'compression':
      return `${mm}mm telephoto — compressed depth, background softened`;
  }
}

function subjectMotionDescriptor(motion: MotionBriefWire['subject_motion']): string {
  switch (motion) {
    case 'locked':
      return 'subject completely still, no motion';
    case 'breath_only':
      return 'subject still except for soft visible breathing';
    case 'loop_idle':
      return 'subject performing a gentle idle loop — small natural movements';
    case 'loop_action':
      return 'subject performing a gentle repeating action that lives inside the 15 seconds';
    case 'one_shot_action':
      return 'subject performs one single arc of action — beginning, middle, and rest — across the 15 seconds';
  }
}

function lightingMotionDescriptor(motion: MotionBriefWire['lighting_motion']): string {
  switch (motion) {
    case 'static':
      return 'lighting holds still';
    case 'drifting_sunbeam':
      return 'a warm sunbeam drifts gently across the frame';
    case 'leaf_dapple_breeze':
      return 'dappled leaf shadows shift softly in a low breeze';
    case 'candle_flicker':
      return 'soft candle flicker on the subject and nearby surfaces';
    case 'dust_motes':
      return 'gentle dust motes float through a beam of light';
    case 'rim_light_pulse':
      return 'a slow, almost-imperceptible rim-light pulse on the subject';
  }
}

function dofDescriptor(behavior: MotionBriefWire['dof_behavior']): string {
  switch (behavior) {
    case 'locked_shallow':
      return 'locked shallow depth of field, subject sharp, background creamy soft';
    case 'locked_deep':
      return 'locked deep depth of field, subject and environment both readable';
    case 'rack_to_subject':
      return 'rack focus from environment to subject — environment softens as the subject sharpens';
    case 'rack_to_environment':
      return 'rack focus from subject to environment — subject softens as the environment sharpens';
    case 'rack_to_caption':
      return 'rack focus from subject toward an empty area where a caption will sit — leave lower-third quiet';
  }
}

function shotStructureDescriptor(structure: MotionBriefWire['shot_structure']): string {
  switch (structure) {
    case 'single_sustained':
      return 'one sustained shot across the full 15 seconds — no internal cut';
    case 'two_shot_cut':
      return 'two internal shots inside the 15-second clip — one cut, both shots calm and continuous in feel';
    case 'three_shot_montage':
      return 'three internal shots inside the 15-second clip — a gentle micro-montage, each beat held long enough to read';
  }
}

function ambientDescriptor(ambient: MotionBriefWire['ambient_audio']): string {
  switch (ambient) {
    case 'birdsong':
      return 'ambient distant birdsong, soft and natural';
    case 'wind_grass':
      return 'ambient soft wind through grass, gentle and unhurried';
    case 'hearth_crackle':
      return 'ambient soft hearth crackle, warm and intimate';
    case 'soft_rain':
      return 'ambient soft rain, light and steady';
    case 'water_lapping':
      return 'ambient gentle water lapping, calm and meditative';
    case 'silence':
      return 'near-silence with just a hint of room tone';
    case 'breath_only':
      return 'only the subject\'s soft breathing, no environmental sound';
  }
}

function audioIntensityDescriptor(intensity: MotionBriefWire['audio_intensity']): string {
  switch (intensity) {
    case 'bed_only':
      return 'sitting low under the picture as a bed';
    case 'present':
      return 'clearly present but never foregrounded';
    case 'forward':
      return 'forward in the mix, leading the scene';
  }
}

function aspectFramingDirective(aspect: NormalizedAspect): string {
  switch (aspect) {
    case '9:16':
      return 'Vertical 9:16 framing at 1080p.';
    case '16:9':
      return 'Horizontal 16:9 framing at 1080p.';
    case '1:1':
      return 'Square 1:1 framing at 1080p.';
  }
}
