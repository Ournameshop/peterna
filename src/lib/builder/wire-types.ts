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

  // Phase 4b — storyboard frame asset IDs (length N, one per beat).
  storyboard_frame_asset_ids: string[] | null;
  storyboard_approved_at: string | null;

  // Phase 5 — The Words (5.5) + Card Preview (5.6).
  opening_title_card_text: string | null;
  closing_card_text: string | null;
  music_track_id: string | null;
  narration_voice_id: string | null;
  narration_text: string | null;
  card_preview_asset_ids: string[] | null;  // length 3: [opening, closing, in_scene]
  card_preview_approved_at: string | null;

  // Phase 6 — Cinematography Engine.
  cinematography_frame_vision: FrameVisionWire[] | null;
  cinematography_briefs: MotionBriefWire[] | null;
  cinematography_dp_overlay: DpStyleOverlayId | null;
  cinematography_approved_at: string | null;

  // Phase 7 — Video clips (Stage 6) + Assembly (Stage 7).
  video_clip_asset_ids: string[] | null;
  video_clip_statuses: VideoClipStatus[] | null;
  assembled_video_asset_id: string | null;
  video_approved_at: string | null;

  // Phase 8 — Eulogy PDF.
  eulogy_pdf_asset_id: string | null;
  eulogy_approved_at: string | null;

  // Phase 9 — Final Delivery (added beyond spec).
  delivery_share_slug: string | null;
  delivery_emailed_to: string | null;
  delivery_ready_at: string | null;

  // Phase 10 — optional FK to users table; null for anonymous sessions.
  user_id: string | null;
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

  opening_title_card_text: string | null;
  closing_card_text: string | null;
  music_track_id: string | null;
  narration_voice_id: string | null;
  narration_text: string | null;

  // Phase 6 — Stage 5.7. The DP-style overlay id is the only cinematography
  // field a client may PATCH directly; `cinematography_briefs` and
  // `cinematography_frame_vision` are written exclusively by the
  // /api/cinematography routes (and the per-brief override PATCH at
  // /api/cinematography). This field is here so an FE that wants to record
  // "user chose Lubezki" before re-deriving briefs can persist that choice
  // independently of the derive call.
  cinematography_dp_overlay: DpStyleOverlayId | null;
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
// Phase 4b — Storyboard (Stage 5) wire types.
// -----------------------------------------------------------------------------

/** Single frame in the storyboard — one per beat. */
export type StoryboardFrameWire = {
  beat_idx: number;
  asset_id: string;
  public_url: string;
};

// POST /api/storyboard/render — generates ALL N frames in parallel (or batched).
// Idempotency-Key honored. Per-session 1-in-flight + budget cap.
export type StoryboardRenderRequest = {
  session_id: string;
};

export type StoryboardRenderResponse =
  | ApiOk<{ frames: StoryboardFrameWire[] }>
  | ApiErr<
      | 'invalid-input'
      | 'session-not-found'
      | 'cookie-mismatch'
      | 'no-session'
      | 'render-in-flight'
      | 'session-budget-exceeded'
      | 'render_failed'
      | 'content-policy-violation'
      | 'no-beats'
      | 'beat-sheet-not-approved'
    >;

// POST /api/storyboard/reroll — re-renders a single frame at beat_idx with
// optional user refinements appended to the prompt.
export type StoryboardRerollRequest = {
  session_id: string;
  beat_idx: number;
  refinements?: string[];
};

export type StoryboardRerollResponse =
  | ApiOk<StoryboardFrameWire>
  | ApiErr<
      | 'invalid-input'
      | 'session-not-found'
      | 'cookie-mismatch'
      | 'no-session'
      | 'render-in-flight'
      | 'session-budget-exceeded'
      | 'render_failed'
      | 'content-policy-violation'
      | 'beat-not-found'
    >;

// POST /api/storyboard/approve — locks the N-frame set and advances stage to
// 'words_render' (Phase 5 entry).
export type StoryboardApproveRequest = {
  session_id: string;
};

export type StoryboardApproveResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr<'invalid-input' | 'session-not-found' | 'cookie-mismatch' | 'incomplete-storyboard'>;

// -----------------------------------------------------------------------------
// Phase 5 — The Words (Stage 5.5) + Card Preview (Stage 5.6) wire types.
// -----------------------------------------------------------------------------

// PATCH /api/words — user updates opening/closing card text, music, narration.
// Captions per-beat are still owned by /api/beat-sheet PATCH.
export type WordsUpdateRequest = {
  session_id: string;
  opening_title_card_text?: string | null;
  closing_card_text?: string | null;
  music_track_id?: string | null;
  narration_voice_id?: string | null;
  narration_text?: string | null;
};

export type WordsUpdateResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr<'invalid-input' | 'session-not-found' | 'cookie-mismatch'>;

// POST /api/words/approve — locks Words and advances to card_preview_render.
export type WordsApproveRequest = {
  session_id: string;
};

export type WordsApproveResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr<'invalid-input' | 'session-not-found' | 'cookie-mismatch'>;

/** Card preview frame — one of the three stills rendered at Stage 5.6. */
export type CardPreviewWire = {
  kind: 'opening' | 'closing' | 'in_scene_caption';
  asset_id: string;
  public_url: string;
};

// POST /api/card-preview/render — renders 3 stills (opening title, closing,
// in-scene caption) at the session's aspect_ratio so the user can see the
// typography in their world BEFORE any video render fires (v2.3 addition).
export type CardPreviewRenderRequest = {
  session_id: string;
};

export type CardPreviewRenderResponse =
  | ApiOk<{ cards: CardPreviewWire[] }>
  | ApiErr<
      | 'invalid-input'
      | 'session-not-found'
      | 'cookie-mismatch'
      | 'no-session'
      | 'render-in-flight'
      | 'session-budget-exceeded'
      | 'render_failed'
      | 'content-policy-violation'
      | 'no-words'
    >;

// POST /api/card-preview/approve — locks the cards and advances to
// 'cinematography_brief' (Phase 6 entry).
export type CardPreviewApproveRequest = {
  session_id: string;
};

export type CardPreviewApproveResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr<'invalid-input' | 'session-not-found' | 'cookie-mismatch' | 'incomplete-cards'>;

// -----------------------------------------------------------------------------
// Phase 6 — Cinematography Engine (Stage 5.7, v2.0) wire types.
// -----------------------------------------------------------------------------

/** Per-frame vision pass output — Part 1 of the engine. */
export type FrameVisionWire = {
  beat_idx: number;
  subject_energy: 'still' | 'low' | 'medium' | 'high';
  subject_pose: 'lying' | 'sitting' | 'standing' | 'walking' | 'running' | 'mid_leap' | 'closed_eyes';
  framing: 'extreme_close' | 'close' | 'medium' | 'wide' | 'extreme_wide';
  environmental_motion: 'still' | 'wind' | 'water' | 'particles' | 'sky' | 'dappled_light';
  depth_layers: 1 | 2 | 3;
  dominant_palette_temperature: 'warm' | 'neutral' | 'cool';
};

/** Per-beat motion brief — Part 2 of the engine. */
export type MotionBriefWire = {
  beat_idx: number;
  lens_mm: 24 | 35 | 50 | 85 | 105;
  lens_character: 'wide_establishing' | 'standard' | 'portrait' | 'compression';
  camera_move:
    | 'locked_off'
    | 'slow_push'
    | 'slow_pull'
    | 'slow_rise'
    | 'slow_fall'
    | 'slow_pan_L'
    | 'slow_pan_R'
    | 'slow_orbit'
    | 'parallax_dolly'
    | 'handheld_float'
    | 'dreamy_drift';
  move_intensity: 'barely_perceptible' | 'gentle' | 'pronounced';
  subject_motion: 'locked' | 'breath_only' | 'loop_idle' | 'loop_action' | 'one_shot_action';
  lighting_motion:
    | 'static'
    | 'drifting_sunbeam'
    | 'leaf_dapple_breeze'
    | 'candle_flicker'
    | 'dust_motes'
    | 'rim_light_pulse';
  dof_behavior:
    | 'locked_shallow'
    | 'locked_deep'
    | 'rack_to_subject'
    | 'rack_to_environment'
    | 'rack_to_caption';
  shot_structure: 'single_sustained' | 'two_shot_cut' | 'three_shot_montage';
  ambient_audio:
    | 'birdsong'
    | 'wind_grass'
    | 'hearth_crackle'
    | 'soft_rain'
    | 'water_lapping'
    | 'silence'
    | 'breath_only';
  audio_intensity: 'bed_only' | 'present' | 'forward';
};

/** DP style overlay options (Part 4 of the engine). */
export type DpStyleOverlayId =
  | 'deakins_minimalist'
  | 'lubezki_natural'
  | 'young_intimate'
  | 'khondji_painterly'
  | 'wong_kar_wai_dreamy'
  | 'none';

// POST /api/cinematography/derive — runs vision-pass-per-frame (Part 1),
// per-beat brief derivation (Part 2), consistency pass (Part 3), optional DP
// overlay (Part 4). Stores both arrays on the session. This is the expensive
// step — N vision calls.
export type CinematographyDeriveRequest = {
  session_id: string;
  dp_style_overlay?: DpStyleOverlayId;
};

export type CinematographyDeriveResponse =
  | ApiOk<{
      frame_vision: FrameVisionWire[];
      briefs: MotionBriefWire[];
    }>
  | ApiErr<
      | 'invalid-input'
      | 'session-not-found'
      | 'cookie-mismatch'
      | 'no-session'
      | 'render-in-flight'
      | 'session-budget-exceeded'
      | 'render_failed'
      | 'storyboard-not-approved'
    >;

// PATCH /api/cinematography — user overrides individual brief fields.
export type CinematographyUpdateRequest = {
  session_id: string;
  beat_idx: number;
  field_overrides: Partial<Omit<MotionBriefWire, 'beat_idx'>>;
};

export type CinematographyUpdateResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr<'invalid-input' | 'session-not-found' | 'cookie-mismatch' | 'beat-not-found'>;

// POST /api/cinematography/approve — locks the briefs and advances to Phase 7.
export type CinematographyApproveRequest = {
  session_id: string;
};

export type CinematographyApproveResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr<'invalid-input' | 'session-not-found' | 'cookie-mismatch' | 'no-briefs'>;

// -----------------------------------------------------------------------------
// Phase 7 — Video Generation (Stage 6) + Assembly (Stage 7) wire types.
// -----------------------------------------------------------------------------

/** Per-clip status during the long video-render process. */
export type VideoClipStatus = 'queued' | 'rendering' | 'done' | 'failed';

export type VideoClipWire = {
  beat_idx: number;
  status: VideoClipStatus;
  asset_id: string | null;     // null until status='done'
  public_url: string | null;
  error?: string;
};

// POST /api/video/render — kicks off all N clip renders (queues them via
// fal.ai's Seedance 2.0). Sequential or batched; the client polls /api/video/status.
export type VideoRenderRequest = {
  session_id: string;
};

export type VideoRenderResponse =
  | ApiOk<{ clips: VideoClipWire[] }>
  | ApiErr<
      | 'invalid-input'
      | 'session-not-found'
      | 'cookie-mismatch'
      | 'no-session'
      | 'render-in-flight'
      | 'session-budget-exceeded'
      | 'cinematography-not-approved'
    >;

// GET /api/video/status — polled by frontend while clips render.
export type VideoStatusResponse =
  | ApiOk<{ clips: VideoClipWire[]; all_done: boolean }>
  | ApiErr<'invalid-input' | 'session-not-found' | 'cookie-mismatch'>;

// POST /api/video/reroll — re-renders a single failed/unwanted clip.
export type VideoRerollRequest = {
  session_id: string;
  beat_idx: number;
};

export type VideoRerollResponse =
  | ApiOk<VideoClipWire>
  | ApiErr<
      | 'invalid-input'
      | 'session-not-found'
      | 'cookie-mismatch'
      | 'render-in-flight'
      | 'beat-not-found'
    >;

// POST /api/assembly/render — stitches all clips + title cards + music +
// optional narration into the final MP4 via ffmpeg. Returns the final asset.
export type AssemblyRenderRequest = {
  session_id: string;
};

export type AssemblyRenderResponse =
  | ApiOk<{ asset_id: string; public_url: string }>
  | ApiErr<
      | 'invalid-input'
      | 'session-not-found'
      | 'cookie-mismatch'
      | 'incomplete-clips'
      | 'assembly_failed'
    >;

// POST /api/assembly/approve — locks the final video and advances to
// Phase 8 (Eulogy PDF entry).
export type AssemblyApproveRequest = {
  session_id: string;
};

export type AssemblyApproveResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr<'invalid-input' | 'session-not-found' | 'cookie-mismatch' | 'no-video'>;

// -----------------------------------------------------------------------------
// Phase 8 — Eulogy PDF (Stage 8) wire types.
// -----------------------------------------------------------------------------

// POST /api/eulogy/render — generates the printable PDF and uploads to S3.
// Returns the asset id + public URL. No vendor call; pure templating server-side.
export type EulogyRenderRequest = {
  session_id: string;
};

export type EulogyRenderResponse =
  | ApiOk<{ asset_id: string; public_url: string }>
  | ApiErr<
      | 'invalid-input'
      | 'session-not-found'
      | 'cookie-mismatch'
      | 'no-session'
      | 'incomplete-tribute'
      | 'render_failed'
    >;

// POST /api/eulogy/approve — locks the PDF and advances to delivery_ready.
export type EulogyApproveRequest = {
  session_id: string;
};

export type EulogyApproveResponse =
  | ApiOk<{ session: SessionWire }>
  | ApiErr<'invalid-input' | 'session-not-found' | 'cookie-mismatch' | 'no-pdf'>;

// -----------------------------------------------------------------------------
// Phase 9 — Final Delivery (added beyond the spec) wire types.
// -----------------------------------------------------------------------------

/** Snapshot of all locked artifacts the delivery page reads. */
export type DeliveryArtifactsWire = {
  session_id: string;
  pet_name: string;
  years_label: string | null;
  character_sheet_url: string | null;
  storyboard_frame_urls: string[];
  card_preview_urls: string[];     // [opening, closing, in_scene]
  assembled_video_url: string | null;
  eulogy_pdf_url: string | null;
  opening_title_card_text: string | null;
  closing_card_text: string | null;
  share_slug: string | null;
  ready_at: string | null;
};

// POST /api/delivery/finalize — generates a shareable slug, snapshots the
// delivery state, marks delivery_ready_at. Idempotent.
export type DeliveryFinalizeRequest = {
  session_id: string;
};

export type DeliveryFinalizeResponse =
  | ApiOk<{ share_slug: string; share_url: string }>
  | ApiErr<'invalid-input' | 'session-not-found' | 'cookie-mismatch' | 'incomplete-tribute'>;

// GET /api/delivery/[slug] — public read; no cookie required (the slug IS the auth).
export type DeliveryFetchResponse =
  | ApiOk<{ artifacts: DeliveryArtifactsWire }>
  | ApiErr<'not-found'>;

// POST /api/delivery/email — sends the share link to a provided email.
export type DeliveryEmailRequest = {
  session_id: string;
  email: string;
};

export type DeliveryEmailResponse =
  | ApiOk<{ sent_to: string }>
  | ApiErr<'invalid-input' | 'session-not-found' | 'cookie-mismatch' | 'send_failed'>;

// -----------------------------------------------------------------------------
// Phase 10 — User accounts via passwordless magic link.
// -----------------------------------------------------------------------------

/** User row over the wire (no internal columns leaked). */
export type UserWire = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  email_verified_at: string | null;
};

// POST /api/auth/magic-link/request — emails a one-time signin link.
// Always returns ok=true regardless of whether the email exists (prevents
// enumeration). Rate-limited per email + per IP.
export type MagicLinkRequestRequest = {
  email: string;
};

export type MagicLinkRequestResponse =
  | ApiOk<{ sent: true }>
  | ApiErr<'invalid-input' | 'rate-limited' | 'send_failed'>;

// GET /api/auth/magic-link/consume?token=... — validates, sets auth_user
// cookie, redirects to /dashboard (or /builder if no prior tributes).
// Returns JSON when called via fetch; HTTP 302 when called by browser nav.
export type MagicLinkConsumeResponse =
  | ApiOk<{ user: UserWire; redirect_to: string }>
  | ApiErr<'invalid-input' | 'token-expired' | 'token-consumed' | 'token-not-found'>;

// GET /api/auth/me — current signed-in user, if any.
export type AuthMeResponse =
  | ApiOk<{ user: UserWire }>
  | ApiOk<{ user: null }>
  | ApiErr;

// POST /api/auth/signout — clears auth_user cookie.
export type AuthSignoutResponse = ApiOk<{ signed_out: true }> | ApiErr;

// -----------------------------------------------------------------------------
// Phase 11 — Memorial Management (dashboard) wire types.
// -----------------------------------------------------------------------------

/** Compact tribute summary for the dashboard list. */
export type TributeListItem = {
  session_id: string;
  pet_name: string | null;
  stage: StageTag;
  created_at: string;
  updated_at: string;
  share_slug: string | null;          // null until Phase 9 finalize
  share_url: string | null;           // built from PUBLIC_BASE_URL + slug
  character_sheet_url: string | null;  // thumbnail for the card
  assembled_video_url: string | null;  // null until Phase 7 done
  is_complete: boolean;                // delivery_ready_at non-null
};

// GET /api/dashboard/tributes — lists tributes for the signed-in user.
// Anonymous users get 401; the dashboard page itself redirects on miss.
export type DashboardListResponse =
  | ApiOk<{ tributes: TributeListItem[] }>
  | ApiErr<'unauthenticated'>;

// POST /api/dashboard/tributes/[id]/rename — updates pet_name.
export type TributeRenameRequest = {
  pet_name: string;
};

export type TributeRenameResponse =
  | ApiOk<{ tribute: TributeListItem }>
  | ApiErr<'invalid-input' | 'unauthenticated' | 'not-found'>;

// POST /api/dashboard/tributes/claim — links the current anonymous session
// (peterna_session cookie) to the signed-in user. Used when a user signs in
// mid-build to preserve their work.
export type TributeClaimResponse =
  | ApiOk<{ claimed: number }>
  | ApiErr<'unauthenticated' | 'nothing-to-claim'>;

// -----------------------------------------------------------------------------
// Phase 12 — Async job queue + completion notifications.
// -----------------------------------------------------------------------------

/** Job summary over the wire — frontend polls /api/video/status which reads jobs. */
export type RenderJobStatus = 'queued' | 'running' | 'done' | 'failed';

// POST /api/push/subscribe — saves a Web Push subscription so we can notify
// the user when a render queue completes. Browser passes the standard
// PushSubscription JSON.
export type PushSubscribeRequest = {
  session_id?: string;             // present for anonymous sessions
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushSubscribeResponse =
  | ApiOk<{ subscribed: true }>
  | ApiErr<'invalid-input'>;

// POST /api/push/unsubscribe — removes a subscription by endpoint.
export type PushUnsubscribeRequest = { endpoint: string };
export type PushUnsubscribeResponse = ApiOk<{ unsubscribed: true }> | ApiErr;

// GET /api/push/vapid-public-key — returns the public key the client uses
// when subscribing.
export type PushVapidKeyResponse = ApiOk<{ public_key: string }> | ApiErr;

// -----------------------------------------------------------------------------
// Helper: PhotoAsset re-export so frontend imports come from one place.
// -----------------------------------------------------------------------------

export type { PhotoAsset, InferredProfile, StageTag };
