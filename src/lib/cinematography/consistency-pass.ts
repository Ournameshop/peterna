// Phase 6 Part 3 — Whole-tribute consistency pass.
//
// After all N briefs are derived independently by `derive-motion-brief.ts`,
// this pure pass enforces tribute-wide constraints. Per the spec:
//
//   1. Lens range constraint — ≤ 2 of {24, 35, 50, 85, 105}. Defaults per
//      format. Out-of-range lenses snap to the nearest in-range lens with
//      the same `lens_character`.
//   2. Move-direction variety — no more than 3 consecutive beats may share
//      the same `camera_move`. Third+ occurrence is rewritten from a
//      derived fallback list.
//   3. Calm bookends — beat 0 (opening) and the last beat (closing) MUST
//      have `move_intensity ≤ gentle` and `shot_structure = single_sustained`.
//   4. Caption-readable scenes — any beat where the caption is ≥ 12 words is
//      forced to `move_intensity = barely_perceptible`. (Caller passes the
//      per-beat caption_word_count alongside the briefs.)
//   5. Ambient continuity — across the tribute, the `ambient_audio` palette
//      must use ≤ 3 sound families. Excess families collapse to the closest
//      already-present family.
//
// This pass is non-negotiable — no brief leaves Phase 6 without all five
// constraints satisfied.

import type { MotionBriefWire } from '@/lib/builder/wire-types';

type LensMm = MotionBriefWire['lens_mm'];
type CameraMove = MotionBriefWire['camera_move'];
type AmbientAudio = MotionBriefWire['ambient_audio'];

// -----------------------------------------------------------------------------
// Format → default lens range. Sourced from the spec's "Lens range constraint"
// paragraph. Music videos get the 3-lens exception.
// -----------------------------------------------------------------------------

export const FORMAT_LENS_RANGE: Record<string, readonly LensMm[]> = {
  day_in_the_life: [35, 85],
  send_off: [50, 85],
  music_video: [35, 50, 85], // spec exception — 3 lenses allowed
  letter_to_my_pet: [50, 85],
  postcards_from: [24, 50],
  // Defaults for formats the spec doesn't enumerate. Conservative — 2 lenses,
  // centred on the standard / portrait region.
  biopic: [35, 85],
  greatest_hits: [35, 50],
  forever_young: [35, 85],
};

const DEFAULT_LENS_RANGE: readonly LensMm[] = [35, 85];

/**
 * The per-beat input the consistency pass needs but the brief alone doesn't
 * carry. `captionWordCount` is sourced from the beat-sheet caption length
 * (BeatWire.caption.split whitespace) by the route handler.
 */
export type ConsistencyInput = {
  beat_idx: number;
  captionWordCount: number;
  archetype: string;
};

export type ConsistencyPassOpts = {
  formatId: string;
  /** Per-beat caption word counts, indexed by beat_idx. Used for rule 4. */
  beatInputs: ReadonlyArray<ConsistencyInput>;
};

/**
 * Apply all five consistency rules to the array of independently-derived
 * briefs. Returns a new array; the input is not mutated.
 *
 * Rule ordering — chosen so each rule sees a stable input:
 *   1. Lens range first (lens character may change → may influence later cuts).
 *   2. Calm bookends (overwrites move_intensity + shot_structure on beat 0 and N-1).
 *   3. Caption-readable (overwrites move_intensity for any high-text beat).
 *   4. Move-direction variety (computed last because earlier rules don't touch camera_move).
 *   5. Ambient continuity (independent of the others — last for clarity).
 *
 * Steps 2-3 both set move_intensity; if the bookend beat has a long caption,
 * "≤ gentle" and "barely_perceptible" reconcile to `barely_perceptible`
 * (the stricter of the two). That's the correct semantic: a 12-word
 * closing card needs a stable frame.
 */
export function applyConsistencyPass(
  briefs: ReadonlyArray<MotionBriefWire>,
  opts: ConsistencyPassOpts,
): MotionBriefWire[] {
  if (briefs.length === 0) return [];

  const sorted = [...briefs].sort((a, b) => a.beat_idx - b.beat_idx);
  const range = FORMAT_LENS_RANGE[opts.formatId] ?? DEFAULT_LENS_RANGE;

  // Rule 1 — Lens range constraint.
  let next = sorted.map((brief) => enforceLensRange(brief, range));

  // Rule 3 (calm bookends).
  next = enforceCalmBookends(next);

  // Rule 4 (caption-readable scenes).
  next = enforceCaptionReadability(next, opts.beatInputs);

  // Rule 2 (move-direction variety).
  next = enforceMoveVariety(next);

  // Rule 5 (ambient continuity).
  next = enforceAmbientContinuity(next);

  // Calm bookends re-check: rule 4 may have mutated bookend intensity to
  // barely_perceptible (stricter — that's fine). Rule 2 only touches camera_move.
  // Shot_structure on bookends remains `single_sustained` because rules 4 and
  // 2 do not touch it.

  return next;
}

// -----------------------------------------------------------------------------
// Rule 1 — Lens range constraint.
// -----------------------------------------------------------------------------

function enforceLensRange(
  brief: MotionBriefWire,
  range: readonly LensMm[],
): MotionBriefWire {
  if (range.includes(brief.lens_mm)) return brief;
  const nearest = nearestLensInRange(brief.lens_mm, range);
  return {
    ...brief,
    lens_mm: nearest,
    lens_character: lensCharacterFor(nearest),
  };
}

function nearestLensInRange(want: LensMm, range: readonly LensMm[]): LensMm {
  let best = range[0]!;
  let bestDist = Math.abs(want - best);
  for (const candidate of range) {
    const d = Math.abs(want - candidate);
    if (d < bestDist) {
      best = candidate;
      bestDist = d;
    }
  }
  return best;
}

function lensCharacterFor(mm: LensMm): MotionBriefWire['lens_character'] {
  if (mm === 24) return 'wide_establishing';
  if (mm === 35 || mm === 50) return 'standard';
  if (mm === 85) return 'portrait';
  return 'compression';
}

// -----------------------------------------------------------------------------
// Rule 2 — Move-direction variety. No more than 3 consecutive shared
// camera_move. The third consecutive scene is rewritten to a derived
// fallback ("second-best" per the spec).
// -----------------------------------------------------------------------------

function enforceMoveVariety(briefs: MotionBriefWire[]): MotionBriefWire[] {
  if (briefs.length < 3) return briefs;
  const out = [...briefs];
  for (let i = 2; i < out.length; i += 1) {
    const a = out[i - 2]!.camera_move;
    const b = out[i - 1]!.camera_move;
    const c = out[i]!.camera_move;
    if (a === b && b === c) {
      out[i] = { ...out[i]!, camera_move: secondBestMove(c, i, out) };
    }
  }
  return out;
}

/** Per the spec: "the third scene is re-derived from its second-best move option." */
function secondBestMove(
  current: CameraMove,
  idx: number,
  briefs: MotionBriefWire[],
): CameraMove {
  // Use a coarse "family" map so the second-best is meaningfully different
  // — e.g. swap slow_pan_L for slow_pan_R, or substitute a push/pull pair.
  const swap: Record<CameraMove, CameraMove> = {
    locked_off: 'slow_push',
    slow_push: 'slow_rise',
    slow_pull: 'slow_fall',
    slow_rise: 'slow_push',
    slow_fall: 'slow_pull',
    slow_pan_L: 'slow_pan_R',
    slow_pan_R: 'slow_pan_L',
    slow_orbit: 'parallax_dolly',
    parallax_dolly: 'slow_orbit',
    handheld_float: 'dreamy_drift',
    dreamy_drift: 'handheld_float',
  };
  let candidate = swap[current];
  // If the candidate itself would create another 3-in-a-row with the next
  // beat, fall back to locked_off (always safe — the bookend rule covers
  // beat 0 / N-1 separately).
  const next = briefs[idx + 1]?.camera_move;
  if (candidate === next && candidate === briefs[idx + 2]?.camera_move) {
    candidate = 'locked_off';
  }
  return candidate;
}

// -----------------------------------------------------------------------------
// Rule 3 — Calm bookends. Beat 0 and beat N-1 force move_intensity ≤ gentle
// AND shot_structure = single_sustained.
// -----------------------------------------------------------------------------

function enforceCalmBookends(briefs: MotionBriefWire[]): MotionBriefWire[] {
  if (briefs.length === 0) return briefs;
  const out = [...briefs];
  const firstIdx = 0;
  const lastIdx = out.length - 1;
  out[firstIdx] = calmBeat(out[firstIdx]!);
  if (lastIdx !== firstIdx) out[lastIdx] = calmBeat(out[lastIdx]!);
  return out;
}

function calmBeat(brief: MotionBriefWire): MotionBriefWire {
  // "≤ gentle" — preserve barely_perceptible if already there.
  const intensity: MotionBriefWire['move_intensity'] =
    brief.move_intensity === 'pronounced' ? 'gentle' : brief.move_intensity;
  return {
    ...brief,
    move_intensity: intensity,
    shot_structure: 'single_sustained',
  };
}

// -----------------------------------------------------------------------------
// Rule 4 — Caption-readable scenes (≥ 12 words → barely_perceptible).
// -----------------------------------------------------------------------------

function enforceCaptionReadability(
  briefs: MotionBriefWire[],
  beatInputs: ReadonlyArray<ConsistencyInput>,
): MotionBriefWire[] {
  const byIdx = new Map<number, ConsistencyInput>();
  for (const b of beatInputs) byIdx.set(b.beat_idx, b);
  return briefs.map((brief) => {
    const beat = byIdx.get(brief.beat_idx);
    if (beat && beat.captionWordCount >= 12) {
      return { ...brief, move_intensity: 'barely_perceptible' as const };
    }
    return brief;
  });
}

// -----------------------------------------------------------------------------
// Rule 5 — Ambient continuity. Tribute-wide audio palette ≤ 3 families.
// Excess families collapse to the closest already-present family using a
// rough adjacency map. The set of three retained is the three most-used.
// -----------------------------------------------------------------------------

const AMBIENT_NEIGHBORS: Record<AmbientAudio, AmbientAudio[]> = {
  birdsong: ['wind_grass', 'silence', 'breath_only'],
  wind_grass: ['birdsong', 'water_lapping', 'silence'],
  hearth_crackle: ['breath_only', 'soft_rain', 'silence'],
  soft_rain: ['water_lapping', 'wind_grass', 'silence'],
  water_lapping: ['soft_rain', 'wind_grass', 'silence'],
  silence: ['breath_only', 'birdsong', 'wind_grass'],
  breath_only: ['silence', 'hearth_crackle', 'birdsong'],
};

function enforceAmbientContinuity(briefs: MotionBriefWire[]): MotionBriefWire[] {
  const counts = new Map<AmbientAudio, number>();
  for (const b of briefs) counts.set(b.ambient_audio, (counts.get(b.ambient_audio) ?? 0) + 1);
  if (counts.size <= 3) return briefs;

  // Keep the three highest-count families. Tie-break stably by enum order
  // (Map iteration order = insertion order; we sort to be explicit).
  const top3 = new Set<AmbientAudio>(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k),
  );

  return briefs.map((brief) => {
    if (top3.has(brief.ambient_audio)) return brief;
    const replacement = nearestAmbient(brief.ambient_audio, top3);
    return { ...brief, ambient_audio: replacement };
  });
}

function nearestAmbient(want: AmbientAudio, allowed: ReadonlySet<AmbientAudio>): AmbientAudio {
  for (const candidate of AMBIENT_NEIGHBORS[want]) {
    if (allowed.has(candidate)) return candidate;
  }
  // Fallback: pick the first allowed family. The Set has size 3 by construction.
  return [...allowed][0]!;
}
