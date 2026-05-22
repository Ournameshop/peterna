// peternal-cinematography.ts — 4-part Cinematography Engine (v2.4)
// Pure, deterministic — same state → byte-identical output every call.

import type {
  FormatId,
  ThemeId,
  ArtStyleId,
  DpStyleId,
  BeatArchetype,
  CameraMove,
  LightingMotion,
  DofBehavior,
  AmbientAudio,
} from '@/lib/peternal-library';

import type { Beat, CinematographyBrief, BuilderState } from '@/app/builder/state';

// ---------------------------------------------------------------------------
// Part 1 — FrameMetadata (simulated deterministic stub)
// ---------------------------------------------------------------------------

export interface FrameMetadata {
  subjectEnergy: 'still' | 'low' | 'medium' | 'high';
  subjectPose: 'lying' | 'sitting' | 'standing' | 'walking' | 'running' | 'mid_leap' | 'closed_eyes';
  framing: 'extreme_close' | 'close' | 'medium' | 'wide' | 'extreme_wide';
  environmentalMotion: 'still' | 'wind' | 'water' | 'particles' | 'sky' | 'dappled_light';
  depthLayers: 1 | 2 | 3;
  dominantPaletteTemperature: 'warm' | 'neutral' | 'cool';
}

// Map every theme to a palette temperature so derivations are deterministic.
const THEME_PALETTE: Record<ThemeId, 'warm' | 'neutral' | 'cool'> = {
  rainbow_bridge:    'warm',
  sunrise_reunion:   'warm',
  gentle_rain:       'cool',
  moonlight_vigil:   'cool',
  quiet_home:        'warm',
  beloved_places:    'warm',
  golden_meadow:     'warm',
  endless_shore:     'neutral',
  forever_playful:   'warm',
  nap_champion:      'warm',
  starlit_reunion:   'cool',
  signs_and_symbols: 'neutral',
};

// Map beat archetypes to a default environmental motion.
const ARCHETYPE_ENV_MOTION: Record<BeatArchetype, FrameMetadata['environmentalMotion']> = {
  open:        'still',
  memory:      'dappled_light',
  connection:  'still',
  ceremonial:  'sky',
  release:     'wind',
  close:       'still',
};

// Map beat archetypes to a default subject pose.
const ARCHETYPE_POSE: Record<BeatArchetype, FrameMetadata['subjectPose']> = {
  open:        'sitting',
  memory:      'standing',
  connection:  'sitting',
  ceremonial:  'standing',
  release:     'running',
  close:       'sitting',
};

// Map beat archetypes to a default subject energy.
const ARCHETYPE_ENERGY: Record<BeatArchetype, FrameMetadata['subjectEnergy']> = {
  open:        'still',
  memory:      'low',
  connection:  'low',
  ceremonial:  'medium',
  release:     'high',
  close:       'still',
};

// Map beat archetypes to a default framing.
const ARCHETYPE_FRAMING: Record<BeatArchetype, FrameMetadata['framing']> = {
  open:        'medium',
  memory:      'close',
  connection:  'extreme_close',
  ceremonial:  'wide',
  release:     'wide',
  close:       'medium',
};

// Keyword → energy bumps for sceneHintSource words.
function sceneHintEnergyBump(hint: string | undefined): 'still' | 'low' | 'medium' | 'high' {
  if (!hint) return 'low';
  const h = hint.toLowerCase();
  if (h.includes('run') || h.includes('bound') || h.includes('leap') || h.includes('chase') || h.includes('fetch') || h.includes('beach') || h.includes('zoom') || h.includes('play') || h.includes('car') || h.includes('snow')) return 'high';
  if (h.includes('walk') || h.includes('trot') || h.includes('patrol') || h.includes('path') || h.includes('backyard') || h.includes('window')) return 'medium';
  if (h.includes('nap') || h.includes('sleep') || h.includes('sunbeam') || h.includes('cuddle')) return 'still';
  return 'low';
}

// Merge two energies — take the max.
const ENERGY_ORDER: FrameMetadata['subjectEnergy'][] = ['still', 'low', 'medium', 'high'];
function mergeEnergy(
  a: FrameMetadata['subjectEnergy'],
  b: FrameMetadata['subjectEnergy'],
): FrameMetadata['subjectEnergy'] {
  return ENERGY_ORDER[Math.max(ENERGY_ORDER.indexOf(a), ENERGY_ORDER.indexOf(b))];
}

export function simulateFrameMetadata(beat: Beat, theme: ThemeId): FrameMetadata {
  const archetype = beat.archetype;
  const baseEnergy = ARCHETYPE_ENERGY[archetype];
  const hintEnergy = sceneHintEnergyBump(beat.visual);
  const subjectEnergy = mergeEnergy(baseEnergy, hintEnergy);

  // Pose: bump upward when hint implies motion.
  let subjectPose = ARCHETYPE_POSE[archetype];
  if (subjectEnergy === 'high' && archetype === 'memory') subjectPose = 'running';
  if (subjectEnergy === 'medium' && archetype === 'memory') subjectPose = 'walking';
  // Gate lying on explicit rest-keyword in the visual — never use it as an archetype default.
  if (archetype === 'memory' && subjectPose === 'standing') {
    const visualLower = (beat.visual ?? '').toLowerCase();
    const sceneHintLower = (beat.sceneHintSource ?? '').toLowerCase();
    if (/nap|sleep|sunbeam|cuddle|curl/.test(visualLower) || /nap|sleep|sunbeam|cuddle|curl/.test(sceneHintLower)) {
      subjectPose = 'lying';
    }
  }

  // Framing: close-up on connection/close, wide on release/ceremonial.
  const framing = ARCHETYPE_FRAMING[archetype];

  // Environmental motion: theme modulates on top of archetype.
  let environmentalMotion = ARCHETYPE_ENV_MOTION[archetype];
  const palette = THEME_PALETTE[theme] ?? 'neutral';
  if (archetype === 'memory' && palette === 'cool') environmentalMotion = 'water';
  if (archetype === 'ceremonial' && theme === 'golden_meadow') environmentalMotion = 'wind';
  if (archetype === 'ceremonial' && theme === 'gentle_rain') environmentalMotion = 'water';
  if (archetype === 'ceremonial' && theme === 'starlit_reunion') environmentalMotion = 'particles';

  // Depth layers: high energy or wide framing → more layers.
  let depthLayers: 1 | 2 | 3 = 2;
  if (framing === 'extreme_close' || framing === 'close') depthLayers = 1;
  if (framing === 'extreme_wide') depthLayers = 3;

  return {
    subjectEnergy,
    subjectPose,
    framing,
    environmentalMotion,
    depthLayers,
    dominantPaletteTemperature: palette,
  };
}

// ---------------------------------------------------------------------------
// Part 2 — deriveBrief
// ---------------------------------------------------------------------------

// lens_mm from framing, with ceremonial nudge.
function deriveLensMm(
  framing: FrameMetadata['framing'],
  archetype: BeatArchetype,
): 24 | 35 | 50 | 85 | 105 {
  const base: Record<FrameMetadata['framing'], 24 | 35 | 50 | 85 | 105> = {
    extreme_close: 85,
    close:         85,
    medium:        50,
    wide:          35,
    extreme_wide:  24,
  };
  let mm = base[framing];
  // Ceremonial beats nudge toward longer lenses (compression).
  if (archetype === 'ceremonial') {
    if (mm === 24) mm = 35;
    else if (mm === 35) mm = 50;
    else if (mm === 50) mm = 85;
  }
  return mm;
}

function deriveLensCharacter(
  mm: 24 | 35 | 50 | 85 | 105,
): CinematographyBrief['lensCharacter'] {
  if (mm === 24) return 'wide_establishing';
  if (mm === 35) return 'standard';
  if (mm === 50) return 'standard';
  if (mm === 85) return 'portrait';
  return 'compression'; // 105
}

// Ordered list of camera moves for variety re-derivation (second-best lookup).
const CAMERA_MOVE_POOL: CameraMove[] = [
  'slow_push',
  'slow_pull',
  'slow_rise',
  'slow_fall',
  'slow_pan_L',
  'slow_pan_R',
  'slow_orbit',
  'parallax_dolly',
  'handheld_float',
  'dreamy_drift',
  'locked_off',
];

function deriveCameraMove(
  energy: FrameMetadata['subjectEnergy'],
  archetype: BeatArchetype,
  prevMove: CameraMove | null,
): CameraMove {
  // Primary derivation matrix.
  let move: CameraMove;
  if (archetype === 'open' || archetype === 'close') {
    move = 'slow_push';
  } else if (archetype === 'connection') {
    move = energy === 'high' ? 'slow_orbit' : 'slow_push';
  } else if (archetype === 'ceremonial') {
    move = 'slow_rise';
  } else if (archetype === 'release') {
    move = energy === 'high' ? 'parallax_dolly' : 'slow_pan_R';
  } else {
    // memory
    const memoryMoves: CameraMove[] = ['slow_push', 'dreamy_drift', 'handheld_float', 'slow_pull'];
    const idx: Record<FrameMetadata['subjectEnergy'], number> = {
      still: 0,
      low:   1,
      medium: 2,
      high:   3,
    };
    move = memoryMoves[idx[energy]];
  }

  // Variety: if same as prev, pick next in pool.
  if (prevMove && move === prevMove) {
    const currentIdx = CAMERA_MOVE_POOL.indexOf(move);
    move = CAMERA_MOVE_POOL[(currentIdx + 1) % CAMERA_MOVE_POOL.length];
  }
  return move;
}

function deriveMoveIntensity(
  captionWordCount: number,
  energy: FrameMetadata['subjectEnergy'],
): CinematographyBrief['moveIntensity'] {
  if (captionWordCount >= 12) return 'barely_perceptible';
  if (energy === 'still') return 'barely_perceptible';
  if (energy === 'high') return 'pronounced';
  return 'gentle';
}

function deriveSubjectMotion(
  pose: FrameMetadata['subjectPose'],
  archetype: BeatArchetype,
  energy: FrameMetadata['subjectEnergy'],
): CinematographyBrief['subjectMotion'] {
  if (archetype === 'open' || archetype === 'close') return 'breath_only';
  if (pose === 'closed_eyes') return 'locked';
  if (pose === 'running' || pose === 'mid_leap') return 'one_shot_action';
  if (pose === 'walking') return 'loop_action';
  // For active archetypes at medium/high energy, never collapse to breath_only.
  const activeArchetype = archetype === 'memory' || archetype === 'connection' || archetype === 'release';
  if (activeArchetype && energy === 'high') return 'one_shot_action';
  if (activeArchetype && energy === 'medium') return 'loop_action';
  // lying is still valid for explicit rest keywords (energy will be still/low).
  if (pose === 'lying') return 'breath_only';
  if (archetype === 'release') return 'loop_action';
  return 'loop_idle';
}

function deriveLightingMotion(
  envMotion: FrameMetadata['environmentalMotion'],
  archetype: BeatArchetype,
): LightingMotion {
  if (archetype === 'open' || archetype === 'close') return 'static';
  const map: Record<FrameMetadata['environmentalMotion'], LightingMotion> = {
    still:        'static',
    wind:         'leaf_dapple_breeze',
    water:        'static',
    particles:    'dust_motes',
    sky:          'drifting_sunbeam',
    dappled_light: 'drifting_sunbeam',
  };
  return map[envMotion];
}

function deriveDofBehavior(
  archetype: BeatArchetype,
  captionWordCount: number,
): DofBehavior {
  if (captionWordCount >= 12) return 'rack_to_caption';
  if (archetype === 'connection') return 'rack_to_subject';
  if (archetype === 'ceremonial') return 'rack_to_environment';
  if (archetype === 'open') return 'locked_shallow';
  if (archetype === 'close') return 'locked_shallow';
  if (archetype === 'release') return 'locked_deep';
  return 'rack_to_subject';
}

function deriveShotStructure(
  energy: FrameMetadata['subjectEnergy'],
  format: FormatId,
  archetype: BeatArchetype,
): CinematographyBrief['shotStructure'] {
  if (archetype === 'ceremonial' || archetype === 'open' || archetype === 'close') {
    return 'single_sustained';
  }
  const nonCeremonialFormats: FormatId[] = [
    'music_video',
    'greatest_hits',
    'forever_young',
  ];
  if (energy === 'high' && nonCeremonialFormats.includes(format)) {
    return 'two_shot_cut';
  }
  return 'single_sustained';
}

function deriveAmbientAudio(
  envMotion: FrameMetadata['environmentalMotion'],
  theme: ThemeId,
  archetype: BeatArchetype,
): AmbientAudio {
  if (archetype === 'close') return 'silence';
  const themeAudio: Partial<Record<ThemeId, AmbientAudio>> = {
    gentle_rain:     'soft_rain',
    moonlight_vigil: 'silence',
    endless_shore:   'water_lapping',
    quiet_home:      'hearth_crackle',
    beloved_places:  'birdsong',
    golden_meadow:   'wind_grass',
    rainbow_bridge:  'birdsong',
    sunrise_reunion: 'birdsong',
    forever_playful: 'birdsong',
    nap_champion:    'hearth_crackle',
    starlit_reunion: 'silence',
    signs_and_symbols: 'wind_grass',
  };
  const byTheme = themeAudio[theme];
  if (byTheme) return byTheme;
  const envMap: Record<FrameMetadata['environmentalMotion'], AmbientAudio> = {
    still:        'silence',
    wind:         'wind_grass',
    water:        'water_lapping',
    particles:    'silence',
    sky:          'birdsong',
    dappled_light: 'birdsong',
  };
  return envMap[envMotion];
}

function deriveAudioIntensity(
  archetype: BeatArchetype,
  positionInArc: number,
  totalBeats: number,
): CinematographyBrief['audioIntensity'] {
  if (archetype === 'open' || archetype === 'close') return 'bed_only';
  if (archetype === 'release') return 'forward';
  const midpoint = totalBeats / 2;
  if (positionInArc >= midpoint) return 'present';
  return 'bed_only';
}

export function deriveBrief(
  frame: FrameMetadata,
  beat: Beat,
  ctx: {
    positionInArc: number;
    totalBeats: number;
    format: FormatId;
    theme: ThemeId;
    style: ArtStyleId;
    prevMove: CameraMove | null;
  },
): CinematographyBrief {
  const captionWordCount = beat.caption.split(/\s+/).filter(Boolean).length;

  const lensMm = deriveLensMm(frame.framing, beat.archetype);
  const lensCharacter = deriveLensCharacter(lensMm);
  const cameraMove = deriveCameraMove(frame.subjectEnergy, beat.archetype, ctx.prevMove);
  const moveIntensity = deriveMoveIntensity(captionWordCount, frame.subjectEnergy);
  const subjectMotion = deriveSubjectMotion(frame.subjectPose, beat.archetype, frame.subjectEnergy);
  const lightingMotion = deriveLightingMotion(frame.environmentalMotion, beat.archetype);
  const dofBehavior = deriveDofBehavior(beat.archetype, captionWordCount);
  const shotStructure = deriveShotStructure(frame.subjectEnergy, ctx.format, beat.archetype);
  const ambientAudio = deriveAmbientAudio(frame.environmentalMotion, ctx.theme, beat.archetype);
  const audioIntensity = deriveAudioIntensity(beat.archetype, ctx.positionInArc, ctx.totalBeats);

  return {
    beatIndex: beat.index,
    lensMm,
    lensCharacter,
    cameraMove,
    moveIntensity,
    subjectMotion,
    lightingMotion,
    dofBehavior,
    shotStructure,
    ambientAudio,
    audioIntensity,
  };
}

// ---------------------------------------------------------------------------
// Part 3 — consistencyPass
// ---------------------------------------------------------------------------

// Default lens ranges by format (spec: ≤2 distinct lenses, except music_video allows 3).
const FORMAT_LENS_RANGES: Partial<Record<FormatId, Array<24 | 35 | 50 | 85 | 105>>> = {
  day_in_the_life: [35, 85],
  send_off:        [50, 85],
  music_video:     [35, 50, 85],
  letter:          [50, 85],
  postcards:       [24, 50],
};

// Default fallback range used when format has no entry.
const DEFAULT_LENS_RANGE: Array<24 | 35 | 50 | 85 | 105> = [50, 85];

function nearestInRange(
  lens: 24 | 35 | 50 | 85 | 105,
  range: Array<24 | 35 | 50 | 85 | 105>,
  character: CinematographyBrief['lensCharacter'],
): 24 | 35 | 50 | 85 | 105 {
  // Prefer a lens in range with the same character.
  const sameChar = range.filter(l => deriveLensCharacter(l) === character);
  const pool = sameChar.length > 0 ? sameChar : range;
  let best = pool[0];
  let bestDist = Math.abs(lens - best);
  for (const l of pool) {
    const d = Math.abs(lens - l);
    if (d < bestDist) { best = l; bestDist = d; }
  }
  return best;
}

// Constraint 1 + ambient continuity helper.
function lensRangePass(
  briefs: CinematographyBrief[],
  format: FormatId,
): { briefs: CinematographyBrief[]; adjustments: string[] } {
  const adjustments: string[] = [];
  const range = FORMAT_LENS_RANGES[format] ?? DEFAULT_LENS_RANGE;
  // music_video is allowed 3; all others must cap at 2 distinct lenses.
  const maxDistinct = format === 'music_video' ? 3 : 2;

  // If already within range, just ensure no out-of-range lens exists.
  const updated = briefs.map(b => {
    if (range.includes(b.lensMm)) return b;
    const replacement = nearestInRange(b.lensMm, range, b.lensCharacter);
    adjustments.push(
      `Scene ${b.beatIndex + 1} lens changed from ${b.lensMm}mm to ${replacement}mm to stay in tribute lens range.`
    );
    return { ...b, lensMm: replacement, lensCharacter: deriveLensCharacter(replacement) };
  });

  // Secondary: if distinct lenses > maxDistinct after range pass, collapse extras.
  const usedAfter = Array.from(new Set(updated.map(b => b.lensMm)));
  if (usedAfter.length > maxDistinct) {
    // Keep the most-used lenses.
    const freq = new Map<number, number>();
    updated.forEach(b => freq.set(b.lensMm, (freq.get(b.lensMm) ?? 0) + 1));
    const sorted = [...usedAfter].sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0));
    const allowed = new Set(sorted.slice(0, maxDistinct));
    return {
      briefs: updated.map(b => {
        if (allowed.has(b.lensMm)) return b;
        const replacement = nearestInRange(
          b.lensMm as 24 | 35 | 50 | 85 | 105,
          [...allowed] as Array<24 | 35 | 50 | 85 | 105>,
          b.lensCharacter,
        );
        adjustments.push(
          `Scene ${b.beatIndex + 1} lens changed from ${b.lensMm}mm to ${replacement}mm to reduce distinct lenses to ${maxDistinct}.`
        );
        return { ...b, lensMm: replacement, lensCharacter: deriveLensCharacter(replacement) };
      }),
      adjustments,
    };
  }

  return { briefs: updated, adjustments };
}

// Constraint 2 — no more than 3 consecutive beats with the same camera_move.
function moveVarietyPass(
  briefs: CinematographyBrief[],
): { briefs: CinematographyBrief[]; adjustments: string[] } {
  const adjustments: string[] = [];
  const result = [...briefs];
  for (let i = 2; i < result.length; i++) {
    if (
      result[i].cameraMove === result[i - 1].cameraMove &&
      result[i].cameraMove === result[i - 2].cameraMove
    ) {
      const currentMove = result[i].cameraMove;
      const currentIdx = CAMERA_MOVE_POOL.indexOf(currentMove);
      const nextMove = CAMERA_MOVE_POOL[(currentIdx + 1) % CAMERA_MOVE_POOL.length];
      adjustments.push(
        `Scene ${result[i].beatIndex + 1} camera move changed from ${currentMove} to ${nextMove} to break 3-consecutive-same-move run.`
      );
      result[i] = { ...result[i], cameraMove: nextMove };
    }
  }
  return { briefs: result, adjustments };
}

// Constraint 3 — calm bookends.
function calmBookendsPass(
  briefs: CinematographyBrief[],
): { briefs: CinematographyBrief[]; adjustments: string[] } {
  const adjustments: string[] = [];
  const result = [...briefs];
  if (result.length === 0) return { briefs: result, adjustments };

  const INTENSITY_ORDER: CinematographyBrief['moveIntensity'][] = [
    'barely_perceptible',
    'gentle',
    'pronounced',
  ];

  function enforce(idx: number, label: string) {
    const b = result[idx];
    const needsIntensityFix = INTENSITY_ORDER.indexOf(b.moveIntensity) > 1; // > gentle
    const needsStructureFix = b.shotStructure !== 'single_sustained';
    if (needsIntensityFix) {
      adjustments.push(
        `${label} (scene ${b.beatIndex + 1}) move_intensity changed to gentle for calm bookend.`
      );
      result[idx] = { ...result[idx], moveIntensity: 'gentle' };
    }
    if (needsStructureFix) {
      adjustments.push(
        `${label} (scene ${b.beatIndex + 1}) shot_structure changed to single_sustained for calm bookend.`
      );
      result[idx] = { ...result[idx], shotStructure: 'single_sustained' };
    }
  }

  enforce(0, 'Opening beat');
  enforce(result.length - 1, 'Closing beat');
  return { briefs: result, adjustments };
}

// Constraint 4 — caption-readable: ≥12 words → barely_perceptible.
function captionReadablePass(
  briefs: CinematographyBrief[],
  beats: Beat[],
): { briefs: CinematographyBrief[]; adjustments: string[] } {
  const adjustments: string[] = [];
  const result = briefs.map((b, idx) => {
    const beat = beats[idx];
    if (!beat) return b;
    const wc = beat.caption.split(/\s+/).filter(Boolean).length;
    if (wc >= 12 && b.moveIntensity !== 'barely_perceptible') {
      adjustments.push(
        `Scene ${b.beatIndex + 1} move_intensity forced to barely_perceptible (caption has ${wc} words ≥ 12).`
      );
      return { ...b, moveIntensity: 'barely_perceptible' as const };
    }
    return b;
  });
  return { briefs: result, adjustments };
}

// Constraint 5 — ambient continuity: ≤3 sound families.
function ambientContinuityPass(
  briefs: CinematographyBrief[],
): { briefs: CinematographyBrief[]; adjustments: string[] } {
  const adjustments: string[] = [];
  const freq = new Map<AmbientAudio, number>();
  for (const b of briefs) {
    freq.set(b.ambientAudio, (freq.get(b.ambientAudio) ?? 0) + 1);
  }
  if (freq.size <= 3) return { briefs: [...briefs], adjustments };

  // Keep the 3 most-frequent families.
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const allowed = new Set(sorted.slice(0, 3).map(([id]) => id));

  // Map of collapse targets (minority → nearest allowed).
  const AUDIO_ORDER: AmbientAudio[] = [
    'birdsong', 'wind_grass', 'hearth_crackle', 'soft_rain', 'water_lapping', 'silence', 'breath_only',
  ];
  function nearestAllowed(audio: AmbientAudio): AmbientAudio {
    if (allowed.has(audio)) return audio;
    const idx = AUDIO_ORDER.indexOf(audio);
    let best: AmbientAudio = [...allowed][0];
    let bestDist = Math.abs(idx - AUDIO_ORDER.indexOf(best));
    for (const a of allowed) {
      const d = Math.abs(idx - AUDIO_ORDER.indexOf(a));
      if (d < bestDist) { best = a; bestDist = d; }
    }
    return best;
  }

  const result = briefs.map(b => {
    if (allowed.has(b.ambientAudio)) return b;
    const replacement = nearestAllowed(b.ambientAudio);
    adjustments.push(
      `Scene ${b.beatIndex + 1} ambient audio changed from ${b.ambientAudio} to ${replacement} to keep ≤3 sound families.`
    );
    return { ...b, ambientAudio: replacement };
  });
  return { briefs: result, adjustments };
}

export function consistencyPass(
  briefs: CinematographyBrief[],
  format: FormatId,
  beats: Beat[],
): { briefs: CinematographyBrief[]; adjustments: string[] } {
  const allAdjustments: string[] = [];

  const pass1 = lensRangePass(briefs, format);
  allAdjustments.push(...pass1.adjustments);

  const pass2 = moveVarietyPass(pass1.briefs);
  allAdjustments.push(...pass2.adjustments);

  const pass3 = calmBookendsPass(pass2.briefs);
  allAdjustments.push(...pass3.adjustments);

  const pass4 = captionReadablePass(pass3.briefs, beats);
  allAdjustments.push(...pass4.adjustments);

  const pass5 = ambientContinuityPass(pass4.briefs);
  allAdjustments.push(...pass5.adjustments);

  return { briefs: pass5.briefs, adjustments: allAdjustments };
}

// ---------------------------------------------------------------------------
// Part 4 — applyDpStyle
// ---------------------------------------------------------------------------

// DP bias tables — purely additive biases, never produces out-of-enum values.
const DP_LENS_PREFERENCE: Partial<Record<DpStyleId, Array<24 | 35 | 50 | 85 | 105>>> = {
  deakins_minimalist:  [50],
  lubezki_natural:     [35],
  young_intimate:      [85, 105],
  khondji_painterly:   [50, 85],
  wong_kar_wai_dreamy: [35, 50],
};

const DP_MOVE_PREFERENCE: Partial<Record<DpStyleId, CameraMove[]>> = {
  deakins_minimalist:  ['locked_off', 'slow_push'],
  lubezki_natural:     ['handheld_float', 'parallax_dolly'],
  young_intimate:      ['slow_push', 'locked_off'],
  khondji_painterly:   ['dreamy_drift', 'slow_orbit'],
  wong_kar_wai_dreamy: ['dreamy_drift', 'slow_pan_L'],
};

const DP_DOF_PREFERENCE: Partial<Record<DpStyleId, DofBehavior>> = {
  deakins_minimalist:  'locked_deep',
  young_intimate:      'rack_to_subject',
  khondji_painterly:   'locked_deep',
  wong_kar_wai_dreamy: 'rack_to_environment',
};

const DP_LIGHTING_PREFERENCE: Partial<Record<DpStyleId, LightingMotion[]>> = {
  deakins_minimalist:  ['static'],
  lubezki_natural:     ['drifting_sunbeam', 'leaf_dapple_breeze'],
  young_intimate:      ['candle_flicker', 'rim_light_pulse'],
  khondji_painterly:   ['dust_motes', 'drifting_sunbeam'],
  wong_kar_wai_dreamy: ['candle_flicker'],
};

export function applyDpStyle(
  briefs: CinematographyBrief[],
  dp: DpStyleId,
): CinematographyBrief[] {
  if (dp === 'none') return briefs;

  const lensPrefs = DP_LENS_PREFERENCE[dp];
  const movePrefs = DP_MOVE_PREFERENCE[dp];
  const dofPref = DP_DOF_PREFERENCE[dp];
  const lightingPrefs = DP_LIGHTING_PREFERENCE[dp];

  return briefs.map((b, i) => {
    let updated = { ...b };

    // Bias lens: apply preferred lens to every other beat to keep variety.
    if (lensPrefs && lensPrefs.length > 0) {
      const preferred = lensPrefs[i % lensPrefs.length];
      // Only bias — don't force all beats to same lens.
      if (i % 2 === 0) {
        updated = {
          ...updated,
          lensMm: preferred,
          lensCharacter: deriveLensCharacter(preferred),
        };
      }
    }

    // Bias camera move on non-bookend beats.
    if (movePrefs && movePrefs.length > 0 && i > 0 && i < briefs.length - 1) {
      updated = { ...updated, cameraMove: movePrefs[i % movePrefs.length] };
    }

    // Bias DOF.
    if (dofPref) {
      updated = { ...updated, dofBehavior: dofPref };
    }

    // Bias lighting on non-bookend beats.
    if (lightingPrefs && lightingPrefs.length > 0 && i > 0 && i < briefs.length - 1) {
      updated = { ...updated, lightingMotion: lightingPrefs[i % lightingPrefs.length] };
    }

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function runCinematographyEngine(
  state: BuilderState,
): { briefs: CinematographyBrief[]; adjustments: string[] } {
  const {
    beatSheet,
    format,
    theme,
    style,
    dpStyle,
  } = state;

  if (!format || !theme || !style) {
    return { briefs: [], adjustments: [] };
  }

  // Step 1 — simulate per-frame metadata.
  const frames = beatSheet.map(beat => simulateFrameMetadata(beat, theme));

  // Step 2 — derive per-beat briefs.
  let prevMove: CameraMove | null = null;
  const rawBriefs: CinematographyBrief[] = beatSheet.map((beat, i) => {
    const brief = deriveBrief(frames[i], beat, {
      positionInArc: i,
      totalBeats: beatSheet.length,
      format,
      theme,
      style,
      prevMove,
    });
    prevMove = brief.cameraMove;
    return brief;
  });

  // Step 3 — optional DP style overlay (before consistency so constraints win).
  const styledBriefs = dpStyle !== 'none'
    ? applyDpStyle(rawBriefs, dpStyle)
    : rawBriefs;

  // Step 4 — consistency pass.
  const { briefs, adjustments } = consistencyPass(styledBriefs, format, beatSheet);

  return { briefs, adjustments };
}
