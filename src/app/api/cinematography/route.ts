import { eq } from 'drizzle-orm';

import { errJson, okJson } from '@/lib/api/respond';
import { serializeSession } from '@/lib/builder/serialize';
import type { MotionBriefWire } from '@/lib/builder/wire-types';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { authBySession } from '@/lib/session/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * PATCH /api/cinematography (Stage 5.7, v2.0)
 *
 * Body: `CinematographyUpdateRequest`:
 *   { session_id, beat_idx, field_overrides: Partial<Omit<MotionBriefWire, 'beat_idx'>> }
 *
 * User-driven override on a single brief's field set — used when the user
 * eyeballs the consistency-pass output and disagrees with one or two
 * choices. Overrides are applied verbatim to the matching brief; we
 * intentionally do NOT re-run the consistency pass after a manual edit
 * because the user is explicitly overruling the engine. The engine ran
 * consistency before approval; the user is now exercising the
 * "Cinematography Engine v2.0 — user override" path described in the spec.
 *
 * Returns the updated `SessionWire`.
 */
export async function PATCH(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errJson('invalid-input', { status: 400 });
  }

  const sessionId = body.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return errJson('invalid-input', { status: 400, details: { field: 'session_id' } });
  }
  const beatIdx = body.beat_idx;
  if (typeof beatIdx !== 'number' || !Number.isInteger(beatIdx) || beatIdx < 0) {
    return errJson('invalid-input', { status: 400, details: { field: 'beat_idx' } });
  }
  const fieldOverrides = body.field_overrides;
  if (!fieldOverrides || typeof fieldOverrides !== 'object' || Array.isArray(fieldOverrides)) {
    return errJson('invalid-input', { status: 400, details: { field: 'field_overrides' } });
  }

  const issues = validateFieldOverrides(fieldOverrides as Record<string, unknown>);
  if (issues.length > 0) {
    return errJson('invalid-input', { status: 400, details: { issues } });
  }

  const auth = await authBySession(sessionId);
  if (!auth.ok) return errJson(auth.error, { status: auth.status });

  const briefs = (auth.session.cinematographyBriefs as MotionBriefWire[] | null) ?? null;
  if (!Array.isArray(briefs) || briefs.length === 0) {
    return errJson('beat-not-found', { status: 400, details: { reason: 'no-briefs' } });
  }

  const target = briefs.find((b) => b.beat_idx === beatIdx);
  if (!target) {
    return errJson('beat-not-found', { status: 400, details: { beat_idx: beatIdx } });
  }

  // Apply only the allowed override fields verbatim.
  const overrides = fieldOverrides as Partial<Omit<MotionBriefWire, 'beat_idx'>>;
  const updatedBrief: MotionBriefWire = { ...target, ...overrides, beat_idx: target.beat_idx };

  // If lens_mm changed but lens_character didn't, re-derive lens_character so
  // the pair stays internally consistent. The user can still override
  // lens_character explicitly — we only auto-sync when they didn't touch it.
  if ('lens_mm' in overrides && overrides.lens_mm != null && !('lens_character' in overrides)) {
    updatedBrief.lens_character = lensCharacterFor(overrides.lens_mm);
  }

  const nextBriefs = briefs.map((b) => (b.beat_idx === beatIdx ? updatedBrief : b));

  const db = getDb();
  const rows = await db
    .update(sessions)
    .set({
      cinematographyBriefs: nextBriefs,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (rows.length === 0) {
    return errJson('session-not-found', { status: 404 });
  }

  return okJson({ session: serializeSession(rows[0]!) });
}

// -----------------------------------------------------------------------------
// Field-override validation. Each field is checked against its enum literal.
// -----------------------------------------------------------------------------

const LENS_MM = new Set([24, 35, 50, 85, 105]);
const LENS_CHARACTER = new Set(['wide_establishing', 'standard', 'portrait', 'compression']);
const CAMERA_MOVE = new Set([
  'locked_off',
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
]);
const MOVE_INTENSITY = new Set(['barely_perceptible', 'gentle', 'pronounced']);
const SUBJECT_MOTION = new Set([
  'locked',
  'breath_only',
  'loop_idle',
  'loop_action',
  'one_shot_action',
]);
const LIGHTING_MOTION = new Set([
  'static',
  'drifting_sunbeam',
  'leaf_dapple_breeze',
  'candle_flicker',
  'dust_motes',
  'rim_light_pulse',
]);
const DOF_BEHAVIOR = new Set([
  'locked_shallow',
  'locked_deep',
  'rack_to_subject',
  'rack_to_environment',
  'rack_to_caption',
]);
const SHOT_STRUCTURE = new Set(['single_sustained', 'two_shot_cut', 'three_shot_montage']);
const AMBIENT_AUDIO = new Set([
  'birdsong',
  'wind_grass',
  'hearth_crackle',
  'soft_rain',
  'water_lapping',
  'silence',
  'breath_only',
]);
const AUDIO_INTENSITY = new Set(['bed_only', 'present', 'forward']);

function validateFieldOverrides(
  overrides: Record<string, unknown>,
): Array<{ field: string; message: string }> {
  const issues: Array<{ field: string; message: string }> = [];
  const allowed: Record<string, ReadonlySet<unknown>> = {
    lens_mm: LENS_MM,
    lens_character: LENS_CHARACTER,
    camera_move: CAMERA_MOVE,
    move_intensity: MOVE_INTENSITY,
    subject_motion: SUBJECT_MOTION,
    lighting_motion: LIGHTING_MOTION,
    dof_behavior: DOF_BEHAVIOR,
    shot_structure: SHOT_STRUCTURE,
    ambient_audio: AMBIENT_AUDIO,
    audio_intensity: AUDIO_INTENSITY,
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'beat_idx') {
      issues.push({ field: key, message: 'beat_idx is not overridable' });
      continue;
    }
    const set = allowed[key];
    if (!set) {
      issues.push({ field: key, message: 'unknown field' });
      continue;
    }
    if (!set.has(value)) {
      issues.push({ field: key, message: `invalid value for ${key}` });
    }
  }
  return issues;
}

function lensCharacterFor(mm: 24 | 35 | 50 | 85 | 105): MotionBriefWire['lens_character'] {
  if (mm === 24) return 'wide_establishing';
  if (mm === 35 || mm === 50) return 'standard';
  if (mm === 85) return 'portrait';
  return 'compression';
}
