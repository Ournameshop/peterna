// Phase 6 Part 2 — Per-beat motion brief derivation.
//
// Pure function: given the per-frame vision pass output (Part 1), beat
// metadata, format/theme/style context, and the briefs already derived for
// earlier beats, return a fully populated `MotionBriefWire` for the next
// beat.
//
// Source mappings here follow the table in the spec
// (`v2.0 changes — Dynamic Cinematography Engine` § "Part 2 — Per-beat
// motion brief derivation"). Every field has a deterministic source — there
// is NO model in the loop here; the brief is derived from the structured
// vision readout and the beat metadata.
//
// The consistency pass (`./consistency-pass`) runs after every brief is
// derived and may rewrite individual fields to enforce tribute-wide
// constraints. Therefore: each brief is the engine's *best guess* given
// what's been derived so far. Variety guards against repeat camera_move
// across consecutive scenes are applied here as a soft preference — the
// consistency pass is the hard guarantee.

import type {
  FrameVisionWire,
  MotionBriefWire,
} from '@/lib/builder/wire-types';

// -----------------------------------------------------------------------------
// Beat metadata. We pass a thin slice rather than the full BeatWire so the
// derivation logic is unit-testable in isolation.
// -----------------------------------------------------------------------------

export type BeatMetadata = {
  beatIdx: number;
  archetype: string;       // 'opening' | 'rising' | 'turning' | 'peak' | 'descent' | 'closing' | etc.
  positionInArc: number;   // 0..1
  captionWordCount: number;
};

export type FormatContext = {
  formatId: string;        // 'send_off' | 'music_video' | 'day_in_the_life' | ...
  ceremonial: boolean;     // 'send_off' + 'letter_to_my_pet' are ceremonial — single_sustained only.
};

export type ThemeContext = {
  themeId: string;
  emotionalRegister: EmotionalRegister;
};

export type EmotionalRegister = 'tender' | 'celebratory' | 'reflective' | 'transcendent';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function deriveMotionBrief(
  vision: FrameVisionWire,
  beat: BeatMetadata,
  format: FormatContext,
  theme: ThemeContext,
  priorBriefs: ReadonlyArray<MotionBriefWire>,
): MotionBriefWire {
  const lens_mm = pickLensMm(vision.framing, theme.emotionalRegister);
  const lens_character = lensCharacterFor(lens_mm);
  const camera_move = pickCameraMove(vision.subject_energy, beat.archetype, priorBriefs);
  const move_intensity = pickMoveIntensity(
    beat.captionWordCount,
    vision.subject_energy,
    theme.emotionalRegister,
  );
  const subject_motion = pickSubjectMotion(vision.subject_pose, beat.archetype);
  const lighting_motion = pickLightingMotion(
    vision.environmental_motion,
    vision.dominant_palette_temperature,
  );
  const dof_behavior = pickDofBehavior(beat.archetype, beat.captionWordCount);
  const shot_structure = pickShotStructure(vision.subject_energy, format);
  const ambient_audio = pickAmbientAudio(
    vision.environmental_motion,
    theme.themeId,
    theme.emotionalRegister,
  );
  const audio_intensity = pickAudioIntensity(
    theme.emotionalRegister,
    beat.positionInArc,
  );

  return {
    beat_idx: beat.beatIdx,
    lens_mm,
    lens_character,
    camera_move,
    move_intensity,
    subject_motion,
    lighting_motion,
    dof_behavior,
    shot_structure,
    ambient_audio,
    audio_intensity,
  };
}

// -----------------------------------------------------------------------------
// lens_mm: framing × emotional_register × (consistency-pass clamps the range)
//
// Framing collapses to a default lens by optical convention:
//   extreme_close → 105   (macro / detail)
//   close         → 85    (portrait)
//   medium        → 50    (standard)
//   wide          → 35    (environmental)
//   extreme_wide  → 24    (establishing)
// Emotional register nudges:
//   tender / reflective  → +portrait bias (one step longer if 35→50 / 50→85)
//   transcendent         → +wide bias (one step shorter)
//   celebratory          → neutral (standard)
// The consistency pass enforces "≤ 2 of {24,35,50,85,105}" — nothing here
// guarantees the lens stays in the tribute's range. That's by design: we
// derive the *natural* lens for the frame first, then clamp.
// -----------------------------------------------------------------------------

function pickLensMm(
  framing: FrameVisionWire['framing'],
  register: EmotionalRegister,
): MotionBriefWire['lens_mm'] {
  const base: Record<FrameVisionWire['framing'], MotionBriefWire['lens_mm']> = {
    extreme_close: 105,
    close: 85,
    medium: 50,
    wide: 35,
    extreme_wide: 24,
  };
  const start = base[framing];
  if (register === 'tender' || register === 'reflective') {
    // Bias toward portrait/compression where it makes sense.
    if (start === 35) return 50;
    if (start === 50) return 85;
    return start;
  }
  if (register === 'transcendent') {
    // Bias toward establishing.
    if (start === 85) return 50;
    if (start === 50) return 35;
    return start;
  }
  // celebratory + everything else → keep the natural lens.
  return start;
}

function lensCharacterFor(mm: MotionBriefWire['lens_mm']): MotionBriefWire['lens_character'] {
  switch (mm) {
    case 24:
      return 'wide_establishing';
    case 35:
      return 'standard';
    case 50:
      return 'standard';
    case 85:
      return 'portrait';
    case 105:
      return 'compression';
    default:
      return 'standard';
  }
}

// -----------------------------------------------------------------------------
// camera_move: subject_energy × beat_archetype × prior-scene move (variety).
//
// The spec lists 11 slow-only camera moves. We pick the natural move for the
// subject + archetype, then if it would be the SAME as the prior beat's move
// for the second time in a row, we substitute the "second-best" candidate.
// The consistency pass enforces the hard "no more than 3 consecutive" rule;
// this is a soft variety preference so the consistency pass has less to
// rewrite.
// -----------------------------------------------------------------------------

function pickCameraMove(
  energy: FrameVisionWire['subject_energy'],
  archetype: string,
  priorBriefs: ReadonlyArray<MotionBriefWire>,
): MotionBriefWire['camera_move'] {
  const candidates = cameraMoveCandidates(energy, archetype);
  const last = priorBriefs[priorBriefs.length - 1]?.camera_move;
  const secondLast = priorBriefs[priorBriefs.length - 2]?.camera_move;

  for (const c of candidates) {
    if (c === last && last === secondLast) continue; // would make 3 in a row — soft skip.
    return c;
  }
  return candidates[0] ?? 'locked_off';
}

/**
 * Candidate list in priority order. The first is the "natural" choice; later
 * entries are fallbacks for variety. All moves listed are explicitly slow per
 * the Seedance 2.0 rule (`Slow, gentle camera moves only ...`).
 */
function cameraMoveCandidates(
  energy: FrameVisionWire['subject_energy'],
  archetype: string,
): MotionBriefWire['camera_move'][] {
  if (archetype === 'opening' || archetype === 'closing') {
    return ['locked_off', 'slow_push', 'slow_rise'];
  }
  if (archetype === 'peak') {
    if (energy === 'high') return ['slow_orbit', 'parallax_dolly', 'slow_push'];
    return ['slow_push', 'slow_rise', 'slow_orbit'];
  }
  if (archetype === 'turning') {
    return ['slow_pull', 'slow_pan_L', 'slow_pan_R', 'dreamy_drift'];
  }
  if (archetype === 'descent') {
    return ['slow_pull', 'slow_fall', 'dreamy_drift'];
  }
  if (archetype === 'rising') {
    if (energy === 'high') return ['parallax_dolly', 'handheld_float', 'slow_push'];
    return ['slow_push', 'slow_rise', 'parallax_dolly'];
  }
  // Generic / unspecified archetype — drive off energy alone.
  if (energy === 'still') return ['locked_off', 'slow_push', 'dreamy_drift'];
  if (energy === 'low') return ['slow_push', 'slow_rise', 'slow_pan_L'];
  if (energy === 'medium') return ['slow_push', 'slow_orbit', 'handheld_float'];
  return ['slow_orbit', 'parallax_dolly', 'handheld_float'];
}

// -----------------------------------------------------------------------------
// move_intensity: caption_word_count + subject_energy + emotional_register.
//
// Spec: "caption-readable scenes" force `barely_perceptible` (≥12 words) —
// that's a consistency-pass guarantee. We derive a sensible starting value
// here so the consistency pass has less work to do.
// -----------------------------------------------------------------------------

function pickMoveIntensity(
  captionWordCount: number,
  energy: FrameVisionWire['subject_energy'],
  register: EmotionalRegister,
): MotionBriefWire['move_intensity'] {
  if (captionWordCount >= 12) return 'barely_perceptible';
  if (register === 'tender' || register === 'reflective') {
    return energy === 'high' ? 'gentle' : 'barely_perceptible';
  }
  if (register === 'transcendent') return 'gentle';
  // celebratory
  if (energy === 'high') return 'pronounced';
  if (energy === 'medium') return 'gentle';
  return 'barely_perceptible';
}

// -----------------------------------------------------------------------------
// subject_motion: subject_pose × beat_archetype.
//
// Closed-eyes / lying → locked or breath_only.
// Sitting / standing → loop_idle.
// Walking → loop_action.
// Running / mid_leap → one_shot_action (peak beats), loop_action elsewhere.
// -----------------------------------------------------------------------------

function pickSubjectMotion(
  pose: FrameVisionWire['subject_pose'],
  archetype: string,
): MotionBriefWire['subject_motion'] {
  if (pose === 'closed_eyes') return archetype === 'closing' ? 'locked' : 'breath_only';
  if (pose === 'lying') return 'breath_only';
  if (pose === 'sitting' || pose === 'standing') return 'loop_idle';
  if (pose === 'walking') return 'loop_action';
  if (pose === 'running' || pose === 'mid_leap') {
    return archetype === 'peak' ? 'one_shot_action' : 'loop_action';
  }
  return 'breath_only';
}

// -----------------------------------------------------------------------------
// lighting_motion: environmental_motion × time_of_day_implied (via palette).
//
// The vision pass doesn't extract a literal time-of-day; we use the dominant
// palette temperature as a proxy (warm → golden hour; cool → blue hour; the
// neutral path → bright midday or interior). The mapping is opinionated but
// motivated by the spec's list of values.
// -----------------------------------------------------------------------------

function pickLightingMotion(
  envMotion: FrameVisionWire['environmental_motion'],
  palette: FrameVisionWire['dominant_palette_temperature'],
): MotionBriefWire['lighting_motion'] {
  if (envMotion === 'still') {
    // Indoor / static scene — favour candle or rim-light for tender warmth,
    // dust for neutral/cool atmospheres.
    if (palette === 'warm') return 'candle_flicker';
    if (palette === 'cool') return 'dust_motes';
    return 'static';
  }
  if (envMotion === 'wind' || envMotion === 'sky') {
    return palette === 'warm' ? 'drifting_sunbeam' : 'leaf_dapple_breeze';
  }
  if (envMotion === 'dappled_light') return 'leaf_dapple_breeze';
  if (envMotion === 'particles') return palette === 'warm' ? 'drifting_sunbeam' : 'dust_motes';
  if (envMotion === 'water') return 'rim_light_pulse';
  return 'static';
}

// -----------------------------------------------------------------------------
// dof_behavior: beat_archetype × caption_word_count.
//
// Spec: rack_to_caption is reserved for "caption-readable" beats (long
// captions). Opening / closing default to locked_shallow for a portrait
// hold. Turning beats favour rack_to_subject; descent favours
// rack_to_environment.
// -----------------------------------------------------------------------------

function pickDofBehavior(
  archetype: string,
  captionWordCount: number,
): MotionBriefWire['dof_behavior'] {
  if (captionWordCount >= 12) return 'rack_to_caption';
  if (archetype === 'opening' || archetype === 'closing') return 'locked_shallow';
  if (archetype === 'turning' || archetype === 'peak') return 'rack_to_subject';
  if (archetype === 'descent') return 'rack_to_environment';
  if (archetype === 'rising') return 'locked_deep';
  return 'locked_shallow';
}

// -----------------------------------------------------------------------------
// shot_structure: subject_energy × format.
//
// Spec: "single_sustained is default; multi-shot only on high-energy beats
// in non-ceremonial formats." Ceremonial = send_off / letter_to_my_pet.
// -----------------------------------------------------------------------------

function pickShotStructure(
  energy: FrameVisionWire['subject_energy'],
  format: FormatContext,
): MotionBriefWire['shot_structure'] {
  if (format.ceremonial) return 'single_sustained';
  if (energy === 'high') return 'three_shot_montage';
  if (energy === 'medium') return 'two_shot_cut';
  return 'single_sustained';
}

// -----------------------------------------------------------------------------
// ambient_audio: environment × theme × emotional_register.
// -----------------------------------------------------------------------------

function pickAmbientAudio(
  envMotion: FrameVisionWire['environmental_motion'],
  themeId: string,
  register: EmotionalRegister,
): MotionBriefWire['ambient_audio'] {
  // Theme-driven defaults — match the theme's signature soundscape where
  // there is one.
  if (themeId === 'beloved_places') return 'hearth_crackle';
  if (themeId === 'stars') return 'silence';
  if (themeId === 'quiet_home' || themeId === 'eternal_garden') return 'hearth_crackle';

  if (envMotion === 'water') return 'water_lapping';
  if (envMotion === 'wind' || envMotion === 'sky') return 'wind_grass';
  if (envMotion === 'dappled_light' || envMotion === 'particles') {
    return register === 'transcendent' ? 'silence' : 'birdsong';
  }
  if (envMotion === 'still') {
    return register === 'tender' ? 'breath_only' : 'silence';
  }
  return 'wind_grass';
}

// -----------------------------------------------------------------------------
// audio_intensity: emotional_register × position_in_arc.
//
// Peak position (0.4–0.7) gets `forward`; bookends get `bed_only`. Tender /
// reflective registers stay quieter overall.
// -----------------------------------------------------------------------------

function pickAudioIntensity(
  register: EmotionalRegister,
  positionInArc: number,
): MotionBriefWire['audio_intensity'] {
  if (positionInArc <= 0.15 || positionInArc >= 0.85) return 'bed_only';
  if (register === 'tender' || register === 'reflective') return 'present';
  if (positionInArc >= 0.4 && positionInArc <= 0.7) return 'forward';
  return 'present';
}

// -----------------------------------------------------------------------------
// Helper: emotional register lookup for a theme id. Themes the library
// doesn't expose are mapped to 'reflective' as the safe default.
// -----------------------------------------------------------------------------

export function emotionalRegisterFor(themeId: string): EmotionalRegister {
  switch (themeId) {
    case 'rainbow_bridge':
    case 'stars':
    case 'storybook':
      return 'transcendent';
    case 'golden_meadow':
    case 'adventure':
    case 'painted_memory':
      return 'celebratory';
    case 'beloved_places':
    case 'eternal_garden':
    case 'quiet_home':
    case 'vintage_album':
      return 'tender';
    default:
      return 'reflective';
  }
}

/** Format → ceremonial classification. `send_off` and `letter_to_my_pet`
 *  are the spec's two non-multi-shot formats; everything else permits
 *  multi-shot on high-energy beats. */
export function isCeremonialFormat(formatId: string): boolean {
  return formatId === 'send_off' || formatId === 'letter_to_my_pet';
}
