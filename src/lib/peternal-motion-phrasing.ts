// peternal-motion-phrasing.ts — pure phrasing dictionary for Seedance prompts.
// No React, no I/O. Exhaustive Record maps so missed enum values fail the build.

import type {
  CameraMove,
  LightingMotion,
  DofBehavior,
  BeatArchetype,
} from '@/lib/peternal-library';

type MoveIntensity = 'barely_perceptible' | 'gentle' | 'pronounced';
type SubjectMotion = 'locked' | 'breath_only' | 'loop_idle' | 'loop_action' | 'one_shot_action';

// Movement quality described as its own clean sentence — appended after the
// camera-move sentence, never spliced mid-clause.
const INTENSITY_DESC: Record<MoveIntensity, string> = {
  barely_perceptible: 'The camera movement is very subtle — slow and almost imperceptible.',
  gentle:             'The camera movement is gentle and steady.',
  pronounced:         'The camera movement is clearly visible and confident.',
};

const CAMERA_MOVE_TEMPLATE: Record<CameraMove, string> = {
  slow_push:      'The camera slowly and continuously dollies inward toward {subject} across the entire clip, closing distance with quiet intimacy.',
  slow_pull:      'The camera slowly pulls back across the whole clip, gradually revealing more of the world around {subject}.',
  slow_rise:      'The camera cranes slowly upward across the clip.',
  slow_fall:      'The camera descends slowly and steadily across the clip, grounding the scene.',
  slow_pan_L:     'The camera performs a slow, steady pan to the left across the clip.',
  slow_pan_R:     'The camera performs a slow, steady pan to the right across the clip.',
  slow_orbit:     'The camera arcs in a smooth, continuous orbit around {subject}.',
  parallax_dolly: 'The camera tracks laterally with {subject}, foreground and background sliding past at different speeds for strong parallax depth.',
  handheld_float: 'A gentle handheld float — the frame breathes and drifts organically.',
  dreamy_drift:   'The camera drifts slowly and weightlessly, a dreamlike untethered glide.',
  locked_off:     'The camera is locked off and still — all motion comes from the subject and the world within the frame.',
};

export function cameraMovePhrase(move: CameraMove, intensity: MoveIntensity): string {
  const base = CAMERA_MOVE_TEMPLATE[move];
  // A locked-off camera has no movement to qualify — return the base sentence.
  if (move === 'locked_off') return base;
  return `${base} ${INTENSITY_DESC[intensity]}`;
}

function pickActionVerb(visual: string): string {
  const v = visual.toLowerCase();
  if (/run|bound|leap|chase|snow|zoom/.test(v)) return 'running and leaping';
  if (/play|fetch|toy/.test(v)) return 'playing';
  if (/beach|sand/.test(v)) return 'running along the sand';
  if (/walk|trot|patrol|path/.test(v)) return 'walking';
  return 'moving naturally';
}

export function subjectMotionPhrase(
  motion: SubjectMotion,
  petName: string,
  species: string,
  visual: string,
): string {
  const subject = `${petName} the ${species}`;
  const MOTION_MAP: Record<SubjectMotion, string> = {
    locked:
      `${subject} holds a still, peaceful pose; eyes soft, serene.`,
    breath_only:
      `${subject} rests calmly; the only motion is the soft, visible rise and fall of breathing and an occasional slow blink.`,
    loop_idle:
      `${subject} is alive and present — shifting weight, an ear flick, a slow head turn, a glance toward the camera.`,
    loop_action:
      `${subject} is actively in motion — ${pickActionVerb(visual)} with natural, full-body movement throughout the clip.`,
    one_shot_action:
      `${subject} performs a single clear action across the clip — ${pickActionVerb(visual)} — energetic and unmistakable.`,
  };
  return MOTION_MAP[motion];
}

const LIGHTING_MOTION_MAP: Record<LightingMotion, string> = {
  static:           'The lighting is steady and still throughout.',
  drifting_sunbeam: 'Soft sunlight drifts and shifts across the scene.',
  leaf_dapple_breeze: 'Dappled light moves across the scene as leaves stir in a gentle breeze.',
  candle_flicker:   'A candle or warm light source flickers softly, casting gentle, living shadows.',
  dust_motes:       'Tiny dust motes or particles drift lazily through shafts of light.',
  rim_light_pulse:  'A soft rim light pulses gently, adding subtle warmth to the edges of the scene.',
};

export function lightingMotionPhrase(motion: LightingMotion): string {
  return LIGHTING_MOTION_MAP[motion];
}

const ARCHETYPE_DIRECTIVE: Record<BeatArchetype, string> = {
  open:       'A calm establishing shot. Quiet, settling motion — the tribute is beginning.',
  memory:     'A living memory. {subject} is doing something — give the scene genuine, natural action and life, not stillness.',
  connection: 'An intimate, tender beat. Small, soulful movement; the camera draws close.',
  ceremonial: 'A graceful, dignified moving shot — slow forward motion.',
  release:    'A joyful, dynamic beat — {subject} moves freely and energetically, full of life.',
  close:      'A gentle, peaceful final shot. Soft, settling motion as the tribute closes.',
};

export function archetypeMotionDirective(archetype: BeatArchetype, petName?: string, species?: string): string {
  const directive = ARCHETYPE_DIRECTIVE[archetype];
  if (!petName || !species) return directive.replace(/\{subject\}/g, 'the pet');
  return directive.replace(/\{subject\}/g, `${petName} the ${species}`);
}

const DOF_MAP: Record<DofBehavior, string> = {
  locked_shallow:     'Shallow depth of field locked throughout — the background stays softly blurred.',
  locked_deep:        'Deep focus locked throughout — the entire scene is sharp and clear.',
  rack_to_subject:    'Focus shifts to settle on the subject.',
  rack_to_environment:'Focus pulls to reveal the wider environment.',
  rack_to_caption:    'Focus is held wide and steady to keep the caption area readable.',
};

export function dofPhrase(dof: DofBehavior): string {
  return DOF_MAP[dof];
}
