// Shared wire-types between the backend route handlers (src/app/api/**/route.ts)
// and the frontend builder client (src/components/builder/**).
//
// Per QA Phase 1 report: the parallel agents shipped against the docs, not against
// each other's code, and ended up with a casing mismatch on every JSON field. The
// fix is to anchor both sides to a single TypeScript module so field names are
// type-checked, not string-literal-typed in two places.
//
// Convention:
//   - Wire is snake_case end-to-end (matches the Postgres column names; the DB is
//     the source of truth, and not converting on every read keeps the surface
//     small enough to maintain). Drizzle still maps these to camelCase JS getters
//     internally — that's an ORM concern.
//   - All envelopes follow `{ ok: true, ...data } | { ok: false, error: <kebab> }`.
//   - Per-route request/response types are exported so neither side has to retype
//     them and risk drifting.
//
// This module is `'use client'`-safe (no server-only imports) so both the route
// handlers and the React components can import it.

import type {
  InferredProfile,
  PhotoAsset,
  StageTag,
} from './state';
import type { GenderId } from '@/lib/library/pronouns';
import type { RelationshipId } from '@/lib/library/relationships';
import type {
  FavoriteThingId,
  MemoryPromptId,
  PersonalityTraitId,
} from '@/lib/library/intake';

// -----------------------------------------------------------------------------
// Envelopes
// -----------------------------------------------------------------------------

export type ApiOk<T extends Record<string, unknown> = Record<string, never>> = {
  ok: true;
} & T;

export type ApiErr<E extends string = string> = {
  ok: false;
  error: E;
  // Routes may attach diagnostic details (e.g. zod issues) under arbitrary keys.
  [k: string]: unknown;
};

// -----------------------------------------------------------------------------
// SessionWire — JSON shape of a `sessions` row over the wire.
//
// Mirrors the Drizzle row's `inferSelect` exactly except:
//   - timestamps are serialized as ISO strings (JSON has no Date)
//   - column names are snake_case to match the DB and the spec at
//     `docs/tribute-builder/data-model.md`
// -----------------------------------------------------------------------------

export type SessionWire = {
  id: string;
  cookie_token: string;
  resume_token: string;
  stage: StageTag;
  created_at: string;
  updated_at: string;

  returning_user: boolean | null;
  pet_name: string | null;
  pet_name_pronunciation: string | null;
  pet_gender: GenderId | string | null;
  relationship: RelationshipId | string | null;
  memory_prompt_type: MemoryPromptId | string | null;
  memory_prompt_answer: string | null;
  personality_traits: string[] | null;
  favorite_things: string[] | null;
  creator_name: string | null;
  years_label: string | null;

  inferred_profile: InferredProfile | null;
  inferred_confidence: Record<string, 'high' | 'medium' | 'low'> | null;

  beat_count: number | null;
  target_minutes: number | null;
  aspect_ratio: string | null;

  curators_pick_id: string | null;
  format_id: string | null;
  theme_id: string | null;
  style_id: string | null;

  character_sheet_asset_id: string | null;
  combination_preview_asset_id: string | null;

  // Phase 4a — beat sheet array, set by /api/beat-sheet/generate or PATCH.
  // Null until Stage 4 starts; replaced wholesale on user edits.
  beat_sheet: BeatWire[] | null;
  beat_sheet_approved_at: string | null;  // ISO timestamp; null until approve
};

// -----------------------------------------------------------------------------
// PATCH body — the allowlisted snake_case fields a client may write.
//
// Server uses this both for input validation and as the contract published to
// the client. Any field added here must also be wired in the PATCH allowlist in
// `src/app/api/session/[id]/route.ts`; the test for "drift" is that this file
// is the only place either side imports field names from.
// -----------------------------------------------------------------------------

export type SessionPatchBody = Partial<{
  stage: StageTag;
  pet_name: string;
  pet_name_pronunciation: string | null;
  pet_gender: GenderId;
  relationship: RelationshipId;
  memory_prompt_type: MemoryPromptId | null;
  memory_prompt_answer: string | null;
  creator_name: string | null;
  years_label: string | null;
  aspect_ratio: string;
  curators_pick_id: string;
  format_id: string;
  theme_id: string;
  style_id: string;

  personality_traits: PersonalityTraitId[];
  favorite_things: FavoriteThingId[];

  beat_count: number;
  target_minutes: number;

  is_returning_user: boolean;

  inferred_profile: InferredProfile;

  beat_sheet: BeatWire[];
}>;

// -----------------------------------------------------------------------------
// AssetWire — JSON shape of an `assets` row.
// -----------------------------------------------------------------------------

export type AssetWire = {
  id: string;
  session_id: string;
  kind: string;
  source: string;
  r2_key: string;
  public_url: string;
  mime_type: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  vendor_job_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// -----------------------------------------------------------------------------
// Per-route request/response unions.
// -----------------------------------------------------------------------------

// POST /api/session/create
export type SessionCreateResponse =
  | ApiOk<{ session_id: string; resume_token: string }>
  | ApiErr;

// GET /api/session/[id]
export type SessionGetResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr;

// PATCH /api/session/[id]
export type SessionPatchResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr<'invalid-input' | 'invalid-stage-transition' | 'cookie-mismatch' | 'session-not-found' | 'no-session'>;

// POST /api/session/resume/[token]
export type ResumeResponse =
  | ApiOk<{ session_id: string; stage: StageTag; resume_token: string }>
  | ApiErr;

// POST /api/upload — multipart form
export type UploadResponse =
  | ApiOk<{ asset_id: string; public_url: string }>
  | ApiErr<'invalid-input' | 'payload-too-large' | 'too-many-photos' | 'cookie-mismatch' | 'session-not-found' | 'no-session'>;

// POST /api/ingest-url
export type IngestUrlAsset = { asset_id: string; public_url: string };
export type IngestUrlFailure = { url: string; reason: string };
export type IngestUrlResponse =
  | ApiOk<{ assets: IngestUrlAsset[]; failed: IngestUrlFailure[] }>
  | ApiErr<'invalid-input' | 'payload-too-large' | 'too-many-photos' | 'cookie-mismatch' | 'session-not-found' | 'no-session'>;

// POST /api/vision-pass
export type VisionPassResponse =
  | ApiOk<{
      inferred_profile: InferredProfile;
      inferred_confidence: Record<string, 'high' | 'medium' | 'low'>;
    }>
  | ApiOk<{ vision_failure: true }>
  | ApiErr;

// -----------------------------------------------------------------------------
// Phase 2 — Character Sheet (Stage 2) wire types.
// -----------------------------------------------------------------------------

// POST /api/character-sheet/render
export type CharacterSheetRenderRequest = {
  session_id: string;
  refinements?: string[];     // spec §2.3 corrections appended to the prompt
  extra_photos?: string[];    // optional additional reference photo asset IDs
};

export type CharacterSheetRenderResponse =
  | ApiOk<{ render_id: string; asset_id: string; public_url: string }>
  | ApiErr<
      | 'invalid-input'
      | 'session-not-found'
      | 'cookie-mismatch'
      | 'no-session'
      | 'render-in-flight'
      | 'session-budget-exceeded'
      | 'render_failed'
      | 'content-policy-violation'
      | 'no-photos'
    >;

// POST /api/character-sheet/approve
export type CharacterSheetApproveRequest = {
  session_id: string;
  asset_id: string;
};

export type CharacterSheetApproveResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr<
      | 'invalid-input'
      | 'session-not-found'
      | 'cookie-mismatch'
      | 'asset-not-found'
      | 'asset-wrong-kind'
    >;

// -----------------------------------------------------------------------------
// Phase 3 — Format / Theme / Style (Stage 3) wire types.
// -----------------------------------------------------------------------------

// POST /api/preview/render
// Renders ONE combination-preview frame showing the user's pet in the chosen
// format+theme+style. Requires character_sheet_asset_id, format_id, theme_id,
// style_id, aspect_ratio all set on the session row.
export type PreviewRenderRequest = {
  session_id: string;
};

export type PreviewRenderResponse =
  | ApiOk<{ render_id: string; asset_id: string; public_url: string }>
  | ApiErr<
      | 'invalid-input'
      | 'session-not-found'
      | 'cookie-mismatch'
      | 'no-session'
      | 'render-in-flight'
      | 'session-budget-exceeded'
      | 'render_failed'
      | 'content-policy-violation'
      | 'character-sheet-not-locked'
      | 'incomplete-stage-3'
    >;

// POST /api/preview/approve
// Locks combination_preview_asset_id and marks Stage 3 complete.
export type PreviewApproveRequest = {
  session_id: string;
  asset_id: string;
};

export type PreviewApproveResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr<
      | 'invalid-input'
      | 'session-not-found'
      | 'cookie-mismatch'
      | 'asset-not-found'
      | 'asset-wrong-kind'
    >;

// -----------------------------------------------------------------------------
// Phase 4a — Beat Sheet (Stage 4) wire types.
// -----------------------------------------------------------------------------

/**
 * A single beat in the tribute. N = beat_count (8/12/16) — derived from
 * target_minutes (2/3/4). Beats are stored as a jsonb array on
 * sessions.beat_sheet (added via Drizzle migration in Phase 4a).
 */
export type BeatWire = {
  idx: number;                  // 0..N-1
  archetype: string;            // 'opening' | 'rising' | 'turning' | 'peak' | 'descent' | 'closing' | ...
  scene_description: string;    // long-form prompt material for Stage 5 storyboard render
  caption: string;              // ≤15 words, per spec — voice from format's caption_voice_pairing
  notes?: string;               // user-edited free-text annotations
};

// POST /api/beat-sheet/generate — produces the N-beat array from the locked
// format/theme/style/character-sheet + intake context. Idempotency-Key honored.
export type BeatSheetGenerateRequest = {
  session_id: string;
};

export type BeatSheetGenerateResponse =
  | ApiOk<{ beats: BeatWire[] }>
  | ApiErr<
      | 'invalid-input'
      | 'session-not-found'
      | 'cookie-mismatch'
      | 'no-session'
      | 'render-in-flight'
      | 'session-budget-exceeded'
      | 'render_failed'
      | 'content-policy-violation'
      | 'incomplete-stage-3'
    >;

// PATCH /api/beat-sheet — user-edited beats persist back. Whole-array replace
// (the array is small; partial updates aren't worth the complexity).
export type BeatSheetUpdateRequest = {
  session_id: string;
  beats: BeatWire[];
};

export type BeatSheetUpdateResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr<'invalid-input' | 'session-not-found' | 'cookie-mismatch'>;

// POST /api/beat-sheet/approve — locks the beat sheet, advances stage to
// 'storyboard_render'. Does not write a separate asset row.
export type BeatSheetApproveRequest = {
  session_id: string;
};

export type BeatSheetApproveResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr<'invalid-input' | 'session-not-found' | 'cookie-mismatch' | 'no-beats'>;

// -----------------------------------------------------------------------------
// Helper: PhotoAsset re-export so frontend imports come from one place.
// -----------------------------------------------------------------------------

export type { PhotoAsset, InferredProfile, StageTag };
