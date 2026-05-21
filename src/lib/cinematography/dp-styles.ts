// Phase 6 Part 4 — Optional DP style overlay.
//
// Five DP-style biases plus `none` per the spec table:
//
//   deakins_minimalist  — Prefer 50mm, locked_off + gentle pushes, deep focus,
//                          single_sustained, static lighting.
//   lubezki_natural     — Prefer 35mm, handheld_float + parallax_dolly,
//                          drifting_sunbeam + leaf_dapple_breeze.
//   young_intimate      — Prefer 85mm + 105mm, slow_push + locked_off, shallow
//                          rack_to_subject, candle_flicker / rim_light_pulse.
//   khondji_painterly   — Prefer 50mm + 85mm, dreamy_drift + slow_orbit,
//                          deep palette compression, dust_motes + drifting_sunbeam.
//   wong_kar_wai_dreamy — Prefer 35mm + 50mm, dreamy_drift + rack_to_environment,
//                          candle_flicker / dreamy_drift.
//   none                — No bias. Returns briefs unchanged.
//
// Per the spec: "Bias only — doesn't override the consistency pass." So this
// pass MUST run BEFORE the consistency pass: it nudges the briefs toward the
// DP's preferred ranges, then the consistency pass enforces the hard
// invariants (lens range, bookends, caption-readable, etc).
//
// Practical effect: the overlay rewrites a field only when the brief's value
// is NOT already one of the preferred values, AND the rewrite preserves
// later-consistency invariants. For lens_mm specifically we leave the value
// alone if it's already in the DP's preferred set; otherwise we substitute
// the nearest preferred lens. For camera_move we substitute the nearest
// preferred move from the same "family" (push/pull/orbit/etc).

import type {
  DpStyleOverlayId,
  MotionBriefWire,
} from '@/lib/builder/wire-types';

type LensMm = MotionBriefWire['lens_mm'];
type CameraMove = MotionBriefWire['camera_move'];
type LightingMotion = MotionBriefWire['lighting_motion'];
type DofBehavior = MotionBriefWire['dof_behavior'];
type ShotStructure = MotionBriefWire['shot_structure'];

type DpStyleBias = {
  preferredLensMm: ReadonlyArray<LensMm>;
  preferredCameraMoves: ReadonlyArray<CameraMove>;
  preferredLightingMotion: ReadonlyArray<LightingMotion>;
  preferredDofBehavior?: ReadonlyArray<DofBehavior>;
  preferredShotStructure?: ShotStructure;
};

export const DP_STYLES: Record<Exclude<DpStyleOverlayId, 'none'>, DpStyleBias> = {
  deakins_minimalist: {
    preferredLensMm: [50],
    preferredCameraMoves: ['locked_off', 'slow_push'],
    preferredLightingMotion: ['static'],
    preferredDofBehavior: ['locked_deep'],
    preferredShotStructure: 'single_sustained',
  },
  lubezki_natural: {
    preferredLensMm: [35],
    preferredCameraMoves: ['handheld_float', 'parallax_dolly'],
    preferredLightingMotion: ['drifting_sunbeam', 'leaf_dapple_breeze'],
  },
  young_intimate: {
    preferredLensMm: [85, 105],
    preferredCameraMoves: ['slow_push', 'locked_off'],
    preferredLightingMotion: ['candle_flicker', 'rim_light_pulse'],
    preferredDofBehavior: ['rack_to_subject', 'locked_shallow'],
  },
  khondji_painterly: {
    preferredLensMm: [50, 85],
    preferredCameraMoves: ['dreamy_drift', 'slow_orbit'],
    preferredLightingMotion: ['dust_motes', 'drifting_sunbeam'],
  },
  wong_kar_wai_dreamy: {
    // Spec lists "candle_flicker / dreamy_drift" in the lighting column — but
    // `dreamy_drift` is a camera_move enum value, not a lighting_motion. Take
    // the spec at the intent level: dreamy lighting → dust_motes is the closest
    // available analogue. The camera_move side picks up dreamy_drift directly.
    preferredLensMm: [35, 50],
    preferredCameraMoves: ['dreamy_drift', 'slow_orbit'],
    preferredLightingMotion: ['candle_flicker', 'dust_motes'],
    preferredDofBehavior: ['rack_to_environment'],
  },
};

/**
 * Apply the DP style overlay to all briefs. If `dpStyleId` is `'none'` or
 * undefined the briefs are returned unchanged.
 *
 * Per spec the overlay is "Bias only — doesn't override the consistency
 * pass." Therefore the caller MUST run the consistency pass AFTER this
 * function. Order matters.
 */
export function applyDpStyleOverlay(
  briefs: ReadonlyArray<MotionBriefWire>,
  dpStyleId: DpStyleOverlayId | null | undefined,
): MotionBriefWire[] {
  if (!dpStyleId || dpStyleId === 'none') return [...briefs];
  const bias = DP_STYLES[dpStyleId];
  if (!bias) return [...briefs];

  return briefs.map((brief) => applyBiasToBrief(brief, bias));
}

function applyBiasToBrief(
  brief: MotionBriefWire,
  bias: DpStyleBias,
): MotionBriefWire {
  let next: MotionBriefWire = { ...brief };

  // Lens — only rewrite if the natural lens is not already preferred.
  if (!bias.preferredLensMm.includes(brief.lens_mm)) {
    const nearest = nearestLens(brief.lens_mm, bias.preferredLensMm);
    next = { ...next, lens_mm: nearest, lens_character: lensCharacterFor(nearest) };
  }

  // Camera move — substitute only if not already preferred. We pick the
  // first preferred move; the consistency pass will handle 3-in-a-row.
  if (!bias.preferredCameraMoves.includes(brief.camera_move)) {
    next = { ...next, camera_move: bias.preferredCameraMoves[0]! };
  }

  // Lighting motion — substitute only if not already preferred AND the
  // bias has at least one preferred value (wong_kar_wai's filter could
  // leave it empty in theory).
  if (
    bias.preferredLightingMotion.length > 0 &&
    !bias.preferredLightingMotion.includes(brief.lighting_motion)
  ) {
    next = { ...next, lighting_motion: bias.preferredLightingMotion[0]! };
  }

  // DOF — optional. If the bias prefers shallow rack and the brief is
  // locked_deep (or vice versa), nudge.
  if (bias.preferredDofBehavior && !bias.preferredDofBehavior.includes(brief.dof_behavior)) {
    next = { ...next, dof_behavior: bias.preferredDofBehavior[0]! };
  }

  // Shot structure — optional override (Deakins-style is single_sustained
  // only; consistency pass keeps it for the bookends regardless).
  if (bias.preferredShotStructure && brief.shot_structure !== bias.preferredShotStructure) {
    next = { ...next, shot_structure: bias.preferredShotStructure };
  }

  return next;
}

function nearestLens(want: LensMm, range: ReadonlyArray<LensMm>): LensMm {
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
