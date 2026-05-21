// Wizard state machine for Stages 1–3. Tagged-union state + pure reducer.
//
// Per ui-components.md §"Wizard state machine": this reducer is the single
// source of truth — it's imported by `PATCH /api/session/[id]` server-side
// to reject illegal skip-ahead. Keep it pure (no I/O, no Date.now), so the
// API and the client agree on transitions.
//
// In Phase 1 we wire Stage 1 transitions end-to-end. Stages 2 and 3 stage
// tags are defined but their events return the same `state` (no-op) until
// the corresponding phase ships.

import type { GenderId } from '@/lib/library/pronouns';
import type { RelationshipId } from '@/lib/library/relationships';
import type {
  FavoriteThingId,
  MemoryPromptId,
  PersonalityTraitId,
} from '@/lib/library/intake';
import type {
  BeatWire,
  CardPreviewWire,
  DpStyleOverlayId,
  FrameVisionWire,
  MotionBriefWire,
  StoryboardFrameWire,
  VideoClipWire,
} from './wire-types';

// -----------------------------------------------------------------------------
// Stage tags — one per screen. URL-driven (?step=...).
// -----------------------------------------------------------------------------

export type StageTag =
  // Stage 1 — Intake
  | 'intake_welcome'
  | 'intake_returning_user_check'
  | 'intake_photos'
  | 'intake_name'
  | 'intake_name_pronunciation' // conditional: heuristic-flagged name
  | 'intake_vision_review' // = "Here's what I see" — skipped on vision_failure
  | 'intake_memory'
  | 'intake_memory_freetext'
  | 'intake_gender'
  | 'intake_relationship'
  | 'intake_traits'
  | 'intake_favorites'
  | 'intake_creator'
  | 'intake_years'
  | 'intake_complete'
  // Stage 2 — Character sheet (defined but not wired in Phase 1)
  | 'character_sheet_render'
  | 'character_sheet_review'
  | 'character_sheet_refinement'
  | 'length_pick'
  | 'aspect_pick'
  // Stage 3 — Format/Theme/Style (defined but not wired in Phase 1)
  | 'curators_pick_or_manual'
  | 'curator_style_confirm'
  | 'format_pick'
  | 'theme_category_pick'
  | 'theme_pick'
  | 'style_pick'
  | 'combination_preview_render'
  | 'combination_preview_review'
  | 'stage_3_complete'
  // Stage 4 — Beat Sheet
  | 'beat_sheet_render'
  | 'beat_sheet_review'
  | 'beat_sheet_complete'
  // Stage 5 — Storyboard
  | 'storyboard_render'
  | 'storyboard_review'
  | 'storyboard_frame_reroll'
  | 'storyboard_complete'
  // Stage 5.5 — The Words.
  //
  // `words_render` is the entry stage from `storyboard_complete` — the user
  // lands directly on the editor (no separate "loading" render screen; the
  // editor is the screen). `words_editor` is reserved as an alias for
  // deep-links and remains the same screen as `words_render`. We keep both
  // tags so a future split of "loading defaults" vs "editor" is possible
  // without a stage-tag migration.
  | 'words_render'
  | 'words_editor'
  | 'words_complete'
  // Stage 5.6 — Card preview (v2.3). Renders the opening title, closing card,
  // and one in-scene caption frame BEFORE any cinematography brief or video
  // render fires.
  | 'card_preview_render'
  | 'card_preview_review'
  | 'card_preview_complete'
  // Stage 5.7 — Cinematography Engine (v2.0). Four sub-stages:
  //   - cinematography_brief: DP overlay picker (5 DPs + "none"). The user
  //     picks a look; tapping "Apply this look" fires the derive call.
  //   - cinematography_render: derive in flight (Part 1 vision pass on every
  //     storyboard frame + Part 2 per-beat brief derivation + Part 3
  //     consistency pass + Part 4 DP bias). ~N vision calls — not cheap.
  //   - cinematography_review: the per-beat brief table. Inline edits PATCH
  //     individual field overrides; "Looks great" approves.
  //   - cinematography_complete: soft pause before Phase 7 entry.
  | 'cinematography_brief'
  | 'cinematography_render'
  | 'cinematography_review'
  | 'cinematography_complete'
  // Stage 6 — Video generation. Sequence:
  //   - video_render: POST /api/video/render fires, then we poll
  //     GET /api/video/status every 5s. Per-clip status grid renders here;
  //     failed clips can be re-rolled in place.
  //   - video_review: optional pause once all clips are done. The user can
  //     re-roll any clip from here before the assembly starts.
  // Stage 7 — Assembly. Sequence:
  //   - assembly_render: POST /api/assembly/render fires. Long render —
  //     "Stitching [PET_NAME]'s tribute together…"
  //   - assembly_review: final MP4 with native <video> controls + gate pills.
  //   - assembly_complete: soft pause before the eulogy PDF entry.
  | 'video_render'
  | 'video_review'
  | 'assembly_render'
  | 'assembly_review'
  | 'assembly_complete'
  // Stage 8 — Eulogy PDF.
  //
  //   - eulogy_render: POST /api/eulogy/render is in flight. "Composing the
  //     eulogy for [PET_NAME]…" while the server templates + uploads the PDF.
  //   - eulogy_review: the PDF is embedded inline (iframe) with a GateReview
  //     pill row: approve / re-render / edit the words.
  //   - eulogy_complete: soft pause between Stage 8 and Phase 9 (delivery).
  | 'eulogy_render'
  | 'eulogy_review'
  | 'eulogy_complete'
  // Phase 9 (added beyond the spec) — Final delivery.
  //
  //   - delivery_ready: POST /api/delivery/finalize is fired (idempotent),
  //     then we show the share URL + copy-to-clipboard + email form.
  //   - delivery_emailed: terminal state after a successful email send. Not
  //     auto-entered — the form lets the user send and stay on the same
  //     screen; this stage exists for deep-link / analytics continuity.
  | 'delivery_ready'
  | 'delivery_emailed';

// -----------------------------------------------------------------------------
// Session data carried alongside the stage. Mirrors the columns on `sessions`
// the frontend cares about — backend owns the full row.
// -----------------------------------------------------------------------------

export type InferredProfile = {
  species?: string;
  species_confidence?: 'high' | 'medium' | 'low';
  breed_guess?: string;
  breed_confidence?: 'high' | 'medium' | 'low';
  coat_description?: string;
  coat_confidence?: 'high' | 'medium' | 'low';
  age_range?: 'puppy_kitten' | 'young_adult' | 'adult' | 'senior';
  age_confidence?: 'high' | 'medium' | 'low';
  body_type?: 'tiny' | 'small' | 'medium' | 'large' | 'giant';
  body_confidence?: 'high' | 'medium' | 'low';
  observed_setting?: string;
  setting_confidence?: 'high' | 'medium' | 'low';
  observed_moment?: string;
  moment_confidence?: 'high' | 'medium' | 'low';
  vision_failure?: boolean;
};

export type PhotoAsset = {
  asset_id: string;
  public_url: string;
};

export type CharacterSheetAsset = {
  asset_id: string;
  public_url: string;
};

export type AspectRatio = '9:16' | '16:9' | '1:1';

export type WizardData = {
  session_id: string | null;
  pet_name: string | null;
  pet_name_pronunciation: string | null;
  pet_photos: PhotoAsset[];
  inferred_profile: InferredProfile | null;
  memory_prompt_type: MemoryPromptId | null;
  memory_prompt_answer: string | null;
  gender: GenderId | null;
  relationship: RelationshipId | null;
  personality_traits: PersonalityTraitId[];
  favorite_things: FavoriteThingId[];
  creator_name: string | null;
  years_label: string | null;
  is_returning_user: boolean;

  // Stage 2 — Character Sheet
  character_sheet: CharacterSheetAsset | null;
  // The refinements the user picked on the most recent attempt, kept in
  // state so the refinement screen can pre-fill them when re-entering.
  pending_refinements: string[];
  pending_refinement_notes: string | null;

  // Stage 2.5 / 2.6
  target_minutes: number | null;
  beat_count: number | null;
  aspect_ratio: AspectRatio | null;

  // Stage 3 — Format / Theme / Style
  curators_pick_id: string | null;
  format_id: string | null;
  theme_id: string | null;
  style_id: string | null;
  /** Transient — which theme category the user picked on 3.3a. Drives the 3.3b
   *  filter; not persisted to the server (the server only cares about the
   *  ultimately chosen theme_id). */
  pending_theme_category: string | null;
  /** The rendered combination-preview asset (Stage 3.5). */
  combination_preview: CharacterSheetAsset | null;

  // Stage 4 — Beat Sheet
  /** N-beat array drafted by the model and edited by the user. Null until
   *  Stage 4's generate route returns. Replaced wholesale on every edit
   *  (whole-array PATCH per spec). */
  beat_sheet: BeatWire[] | null;

  // Stage 5 — Storyboard
  /** N-frame array, one frame per beat. Null until Stage 5's render route
   *  returns. On per-frame reroll the matching entry is replaced in place
   *  (same beat_idx). Length is always === beat_sheet.length when present. */
  storyboard_frames: StoryboardFrameWire[] | null;
  /** Which beat_idx is currently being rerolled (UI guard). Null when no
   *  reroll is in flight. */
  reroll_beat_idx: number | null;

  // Stage 5.5 — The Words.
  //
  // All four are optional from the user's perspective — the editor pre-fills
  // opening + closing with sensible defaults, and music + narration default
  // to "none." `null` here means "not yet set" until the user touches the
  // field; the backend persists `null` as the literal default.
  opening_title_card_text: string | null;
  closing_card_text: string | null;
  music_track_id: string | null;
  narration_voice_id: string | null;
  narration_text: string | null;

  // Stage 5.6 — Card preview. Three stills: opening card, closing card, and
  // one in-scene caption frame. Null until /api/card-preview/render returns.
  card_preview_cards: CardPreviewWire[] | null;

  // Stage 5.7 — Cinematography Engine.
  //
  // `cinematography_dp_overlay` is the user's picker selection from the
  // `cinematography_brief` screen — defaults to 'none' (rules-only derivation).
  // Null until the user has visited the picker; we treat null and 'none'
  // identically when calling /api/cinematography/derive.
  cinematography_dp_overlay: DpStyleOverlayId | null;
  /** Part 1 output — per-frame vision pass. Returned by /derive; not edited. */
  cinematography_frame_vision: FrameVisionWire[] | null;
  /** Part 2 + 3 + 4 output — per-beat motion briefs. The user can override
   *  individual fields via PATCH /api/cinematography; we replace the matching
   *  row in place on each successful patch. */
  cinematography_briefs: MotionBriefWire[] | null;

  // Stage 6 — Video clips.
  //
  // Per-clip wire shape: { beat_idx, status, asset_id, public_url, error? }.
  // The array length matches beat_sheet.length once render kicks off; until
  // then it's null. Per-clip status flips through queued → rendering → done
  // (or failed). The grid card per beat reads from this array.
  video_clips: VideoClipWire[] | null;

  // Stage 7 — Assembly. Final MP4 asset, set once /api/assembly/render returns.
  assembly_asset_id: string | null;
  assembly_public_url: string | null;

  // Stage 8 — Eulogy PDF. The asset id + public URL of the rendered one-page
  // PDF, set once /api/eulogy/render returns. The review screen embeds
  // `eulogy_pdf_url` in an <iframe>; the "Download the eulogy" button on the
  // public delivery page links to the same URL.
  eulogy_pdf_asset_id: string | null;
  eulogy_pdf_url: string | null;

  // Phase 9 — Final delivery.
  //
  // `delivery_share_slug` is the user-shareable slug (the public delivery URL
  // is `/tribute/<slug>`); `delivery_share_url` is the absolute URL the
  // backend computes (host-aware so emails carry a clickable link). Both are
  // set by /api/delivery/finalize. `delivery_emailed_to` is the last
  // successfully emailed recipient — surfaced as a "Sent to <addr>"
  // confirmation under the email form.
  delivery_share_slug: string | null;
  delivery_share_url: string | null;
  delivery_emailed_to: string | null;
};

export type WizardState = {
  stage: StageTag;
  data: WizardData;
};

export const INITIAL_WIZARD_DATA: WizardData = {
  session_id: null,
  pet_name: null,
  pet_name_pronunciation: null,
  pet_photos: [],
  inferred_profile: null,
  memory_prompt_type: null,
  memory_prompt_answer: null,
  gender: null,
  relationship: null,
  personality_traits: [],
  favorite_things: [],
  creator_name: null,
  years_label: null,
  is_returning_user: false,
  character_sheet: null,
  pending_refinements: [],
  pending_refinement_notes: null,
  target_minutes: null,
  beat_count: null,
  aspect_ratio: null,
  curators_pick_id: null,
  format_id: null,
  theme_id: null,
  style_id: null,
  pending_theme_category: null,
  combination_preview: null,
  beat_sheet: null,
  storyboard_frames: null,
  reroll_beat_idx: null,
  opening_title_card_text: null,
  closing_card_text: null,
  music_track_id: null,
  narration_voice_id: null,
  narration_text: null,
  card_preview_cards: null,
  cinematography_dp_overlay: null,
  cinematography_frame_vision: null,
  cinematography_briefs: null,
  video_clips: null,
  assembly_asset_id: null,
  assembly_public_url: null,
  eulogy_pdf_asset_id: null,
  eulogy_pdf_url: null,
  delivery_share_slug: null,
  delivery_share_url: null,
  delivery_emailed_to: null,
};

export function createInitialState(sessionId: string | null = null): WizardState {
  return {
    stage: 'intake_welcome',
    data: { ...INITIAL_WIZARD_DATA, session_id: sessionId },
  };
}

// -----------------------------------------------------------------------------
// Events — what the UI dispatches. Tagged union.
// -----------------------------------------------------------------------------

export type WizardEvent =
  | { type: 'start_intake' }
  | { type: 'returning_user_answered'; isReturning: boolean }
  | { type: 'photos_uploaded'; photos: PhotoAsset[] }
  | { type: 'photos_skipped' }
  | { type: 'name_submitted'; petName: string; pronunciationNeeded: boolean }
  | { type: 'pronunciation_submitted'; pronunciation: string | null }
  | { type: 'vision_pass_complete'; profile: InferredProfile }
  | { type: 'vision_pass_failed' }
  | { type: 'profile_confirmed'; profile?: InferredProfile }
  | {
      type: 'memory_prompt_chosen';
      promptId: MemoryPromptId;
    }
  | { type: 'memory_answered'; promptId: MemoryPromptId | null; answer: string | null }
  | { type: 'memory_skipped' }
  | { type: 'gender_chosen'; gender: GenderId }
  | { type: 'relationship_chosen'; relationship: RelationshipId }
  | { type: 'traits_chosen'; traits: PersonalityTraitId[] }
  | { type: 'favorites_chosen'; favorites: FavoriteThingId[] }
  | { type: 'creator_submitted'; creatorName: string | null }
  | { type: 'years_submitted'; yearsLabel: string | null }
  // Stage 2 — Character Sheet
  | { type: 'character_sheet_render_started' }
  | {
      type: 'character_sheet_rendered';
      asset: CharacterSheetAsset;
    }
  | { type: 'character_sheet_approved' }
  | {
      type: 'character_sheet_refinement_requested';
      refinements: string[];
      notes: string | null;
    }
  | { type: 'character_sheet_restart' } // "Start over" — re-render with no refinements
  // Stage 2.5 + 2.6 pickers
  | {
      type: 'length_chosen';
      targetMinutes: number;
      beatCount: number;
    }
  | { type: 'aspect_chosen'; aspectRatio: AspectRatio }
  // Stage 3 — Format / Theme / Style
  | {
      type: 'curator_pick_chosen';
      curatorsPickId: string;
      formatId: string;
      themeId: string;
      styleId: string;
    }
  | { type: 'curator_style_kept' }
  | { type: 'curator_style_switched'; styleId: string }
  | { type: 'manual_path_chosen' }
  | { type: 'format_chosen'; formatId: string }
  | { type: 'theme_category_chosen'; categoryId: string }
  | { type: 'theme_chosen'; themeId: string }
  | { type: 'style_chosen'; styleId: string }
  | {
      type: 'preview_rendered';
      asset: CharacterSheetAsset;
    }
  | { type: 'preview_approved' }
  | { type: 'preview_restart_style' }
  | { type: 'preview_restart_theme' }
  | { type: 'preview_restart_all' }
  // Stage 4 — Beat Sheet
  | { type: 'beat_sheet_render_started' }
  | { type: 'beat_sheet_rendered'; beats: BeatWire[] }
  | { type: 'beat_sheet_edited'; beats: BeatWire[] }
  | { type: 'beat_sheet_approved' }
  | { type: 'beat_sheet_regenerated' }
  // Stage 5 — Storyboard
  | { type: 'storyboard_render_started' }
  | { type: 'storyboard_rendered'; frames: StoryboardFrameWire[] }
  | { type: 'storyboard_frame_reroll_started'; beatIdx: number }
  | { type: 'storyboard_frame_rerolled'; frame: StoryboardFrameWire }
  | { type: 'storyboard_approved' }
  // Stage 5.5 — The Words
  | {
      type: 'words_loaded';
      openingText: string | null;
      closingText: string | null;
      musicTrackId: string | null;
      narrationVoiceId: string | null;
      narrationText: string | null;
    }
  | {
      type: 'words_updated';
      patch: Partial<{
        opening_title_card_text: string | null;
        closing_card_text: string | null;
        music_track_id: string | null;
        narration_voice_id: string | null;
        narration_text: string | null;
      }>;
    }
  | { type: 'words_approved' }
  // Stage 5.6 — Card preview
  | { type: 'card_preview_render_started' }
  | { type: 'card_preview_rendered'; cards: CardPreviewWire[] }
  | { type: 'card_preview_approved' }
  | { type: 'card_preview_restart_words' }
  | { type: 'card_preview_restart_all' }
  // Stage 5.7 — Cinematography Engine
  | { type: 'cinematography_overlay_chosen'; overlay: DpStyleOverlayId }
  | { type: 'cinematography_derive_started'; overlay: DpStyleOverlayId }
  | {
      type: 'cinematography_derived';
      frame_vision: FrameVisionWire[];
      briefs: MotionBriefWire[];
    }
  | {
      type: 'cinematography_field_edited';
      beatIdx: number;
      brief: MotionBriefWire;
    }
  | { type: 'cinematography_approved' }
  | { type: 'cinematography_restart' }
  // Stage 6 — Video generation.
  //
  // `video_render_started` fires when the user advances out of
  // cinematography_complete and the BuilderClient hits POST /api/video/render.
  // `video_status_polled` lands the latest per-clip array from a status poll
  // (whole-array replace — the wire delivers the canonical state every tick).
  // `video_clip_rerolled` replaces one clip in place after a successful
  // re-roll. `all_clips_done` advances the reducer from video_render to
  // assembly_render so the assembly call kicks off.
  | { type: 'video_render_started' }
  | { type: 'video_status_polled'; clips: VideoClipWire[] }
  | { type: 'video_clip_rerolled'; clip: VideoClipWire }
  | { type: 'all_clips_done' }
  // Stage 7 — Assembly.
  | { type: 'assembly_started' }
  | {
      type: 'assembly_complete_event';
      assetId: string;
      publicUrl: string;
    }
  | { type: 'assembly_approved' }
  // Stage 8 — Eulogy PDF.
  //
  // `eulogy_render_started` is dispatched both on the hand-off CTA ("See the
  // eulogy") and from the review screen's "Re-render the PDF" pill — the
  // BuilderClient distinguishes the two by current stage (the reducer just
  // re-enters the render stage either way). `eulogy_rendered` lands the
  // asset; `eulogy_approved` advances to `eulogy_complete`.
  | { type: 'eulogy_render_started' }
  | { type: 'eulogy_rendered'; assetId: string; publicUrl: string }
  | { type: 'eulogy_approved' }
  // Phase 9 — Final delivery.
  //
  // `delivery_finalize_started` is the hand-off out of eulogy_complete — it
  // moves the user into the `delivery_ready` stage so the BuilderClient's
  // auto-finalize effect can fire POST /api/delivery/finalize.
  // `delivery_finalized` lands the slug + absolute share URL.
  // `delivery_emailed_event` records a successful email send.
  | { type: 'delivery_finalize_started' }
  | {
      type: 'delivery_finalized';
      shareSlug: string;
      shareUrl: string;
    }
  | { type: 'delivery_emailed_event'; sentTo: string }
  | { type: 'session_loaded'; state: WizardState }
  | { type: 'goto'; stage: StageTag };

// -----------------------------------------------------------------------------
// Heuristic: does this pet name need a pronunciation follow-up?
// Per spec §1.3 — non-Latin letters, unusual digraphs, etc.
// -----------------------------------------------------------------------------

const COMMON_NAMES = new Set(
  [
    'spike', 'max', 'bella', 'luna', 'charlie', 'milo', 'cooper', 'buddy',
    'daisy', 'rocky', 'lucy', 'duke', 'molly', 'jack', 'oliver', 'sadie',
    'maggie', 'sophie', 'chloe', 'lola', 'bailey', 'lily', 'zoe', 'roxy',
    'rosie', 'ruby', 'penny', 'piper', 'oscar', 'leo', 'simba', 'shadow',
    'tiger', 'mittens', 'whiskers', 'oreo', 'pepper', 'ginger', 'smokey',
  ],
);

export function needsPronunciationCheck(name: string): boolean {
  const n = name.trim();
  if (n.length === 0) return false;
  if (/[^\x20-\x7E]/.test(n)) return true; // non-ASCII
  const lower = n.toLowerCase();
  if (COMMON_NAMES.has(lower)) return false;
  // Unusual digraphs
  if (/(ph|ng|zh|kh|hr|tz|gn|mn|cz|dz|sz|xh|zw|gh|ll|rr)/i.test(n)) return true;
  // Many consonants in a row
  if (/[bcdfghjklmnpqrstvwxz]{4,}/i.test(n)) return true;
  // Apostrophes / hyphens / accented placeholders
  if (/['’\-]/.test(n)) return true;
  return false;
}

// -----------------------------------------------------------------------------
// Reducer. Pure — no side effects, no Date.now.
// -----------------------------------------------------------------------------

export function reduceState(state: WizardState, event: WizardEvent): WizardState {
  // Allow unconditional overrides (server load, deep-link)
  if (event.type === 'session_loaded') {
    return event.state;
  }
  if (event.type === 'goto') {
    return { ...state, stage: event.stage };
  }

  switch (state.stage) {
    case 'intake_welcome': {
      if (event.type === 'start_intake') {
        return { ...state, stage: 'intake_returning_user_check' };
      }
      // 1.0 doesn't have a continue button. Photo upload from intake_welcome
      // is also legal (the form lives below the panel on the welcome screen).
      if (event.type === 'photos_uploaded') {
        return {
          stage: 'intake_name',
          data: { ...state.data, pet_photos: event.photos },
        };
      }
      if (event.type === 'photos_skipped') {
        return { ...state, stage: 'intake_name' };
      }
      return state;
    }

    case 'intake_returning_user_check': {
      if (event.type === 'returning_user_answered') {
        return {
          stage: 'intake_photos',
          data: { ...state.data, is_returning_user: event.isReturning },
        };
      }
      return state;
    }

    case 'intake_photos': {
      if (event.type === 'photos_uploaded') {
        return {
          stage: 'intake_name',
          data: { ...state.data, pet_photos: event.photos },
        };
      }
      if (event.type === 'photos_skipped') {
        return { ...state, stage: 'intake_name' };
      }
      return state;
    }

    case 'intake_name': {
      if (event.type === 'name_submitted') {
        const nextStage: StageTag = event.pronunciationNeeded
          ? 'intake_name_pronunciation'
          : 'intake_vision_review';
        return {
          stage: nextStage,
          data: { ...state.data, pet_name: event.petName },
        };
      }
      return state;
    }

    case 'intake_name_pronunciation': {
      if (event.type === 'pronunciation_submitted') {
        return {
          stage: 'intake_vision_review',
          data: { ...state.data, pet_name_pronunciation: event.pronunciation },
        };
      }
      return state;
    }

    case 'intake_vision_review': {
      if (event.type === 'vision_pass_complete') {
        return {
          ...state,
          data: { ...state.data, inferred_profile: event.profile },
        };
      }
      if (event.type === 'vision_pass_failed') {
        return {
          stage: 'intake_memory',
          data: {
            ...state.data,
            inferred_profile: { vision_failure: true },
          },
        };
      }
      if (event.type === 'profile_confirmed') {
        return {
          stage: 'intake_memory',
          data: event.profile
            ? { ...state.data, inferred_profile: event.profile }
            : state.data,
        };
      }
      return state;
    }

    case 'intake_memory': {
      if (event.type === 'memory_prompt_chosen') {
        return {
          stage: 'intake_memory_freetext',
          data: { ...state.data, memory_prompt_type: event.promptId },
        };
      }
      if (event.type === 'memory_skipped') {
        return { ...state, stage: 'intake_gender' };
      }
      return state;
    }

    case 'intake_memory_freetext': {
      if (event.type === 'memory_answered') {
        return {
          stage: 'intake_gender',
          data: {
            ...state.data,
            memory_prompt_type: event.promptId ?? state.data.memory_prompt_type,
            memory_prompt_answer: event.answer,
          },
        };
      }
      if (event.type === 'memory_skipped') {
        return { ...state, stage: 'intake_gender' };
      }
      return state;
    }

    case 'intake_gender': {
      if (event.type === 'gender_chosen') {
        return {
          stage: 'intake_relationship',
          data: { ...state.data, gender: event.gender },
        };
      }
      return state;
    }

    case 'intake_relationship': {
      if (event.type === 'relationship_chosen') {
        return {
          stage: 'intake_traits',
          data: { ...state.data, relationship: event.relationship },
        };
      }
      return state;
    }

    case 'intake_traits': {
      if (event.type === 'traits_chosen') {
        return {
          stage: 'intake_favorites',
          data: { ...state.data, personality_traits: event.traits },
        };
      }
      return state;
    }

    case 'intake_favorites': {
      if (event.type === 'favorites_chosen') {
        return {
          stage: 'intake_creator',
          data: { ...state.data, favorite_things: event.favorites },
        };
      }
      return state;
    }

    case 'intake_creator': {
      if (event.type === 'creator_submitted') {
        return {
          stage: 'intake_years',
          data: { ...state.data, creator_name: event.creatorName },
        };
      }
      return state;
    }

    case 'intake_years': {
      if (event.type === 'years_submitted') {
        return {
          stage: 'intake_complete',
          data: { ...state.data, years_label: event.yearsLabel },
        };
      }
      return state;
    }

    case 'intake_complete': {
      // Intake-complete is a soft pause screen; the user advances by tapping
      // the "Start the character sheet" button, which fires a render start.
      if (event.type === 'character_sheet_render_started') {
        return { ...state, stage: 'character_sheet_render' };
      }
      return state;
    }

    // Stage 2 — Character Sheet
    case 'character_sheet_render': {
      if (event.type === 'character_sheet_rendered') {
        return {
          stage: 'character_sheet_review',
          data: {
            ...state.data,
            character_sheet: event.asset,
            // Clear pending refinements on a fresh render landing.
            pending_refinements: [],
            pending_refinement_notes: null,
          },
        };
      }
      return state;
    }

    case 'character_sheet_review': {
      if (event.type === 'character_sheet_approved') {
        return { ...state, stage: 'length_pick' };
      }
      if (event.type === 'character_sheet_refinement_requested') {
        // Two paths into a re-render: refinement (with corrections) and
        // restart (no refinements). Both land back on render.
        return {
          stage: 'character_sheet_render',
          data: {
            ...state.data,
            pending_refinements: event.refinements,
            pending_refinement_notes: event.notes,
          },
        };
      }
      if (event.type === 'character_sheet_restart') {
        return {
          stage: 'character_sheet_render',
          data: {
            ...state.data,
            pending_refinements: [],
            pending_refinement_notes: null,
          },
        };
      }
      return state;
    }

    case 'character_sheet_refinement': {
      // The refinement panel is a sub-view of the review screen in the
      // current UI (slides in below the gate review). It can still be a
      // top-level stage if a deep-link lands here. Mirror review behaviors.
      if (event.type === 'character_sheet_refinement_requested') {
        return {
          stage: 'character_sheet_render',
          data: {
            ...state.data,
            pending_refinements: event.refinements,
            pending_refinement_notes: event.notes,
          },
        };
      }
      if (event.type === 'character_sheet_approved') {
        return { ...state, stage: 'length_pick' };
      }
      return state;
    }

    // Stage 2.5 — Length picker
    case 'length_pick': {
      if (event.type === 'length_chosen') {
        return {
          stage: 'aspect_pick',
          data: {
            ...state.data,
            target_minutes: event.targetMinutes,
            beat_count: event.beatCount,
          },
        };
      }
      return state;
    }

    // Stage 2.6 — Aspect picker
    case 'aspect_pick': {
      if (event.type === 'aspect_chosen') {
        return {
          stage: 'curators_pick_or_manual',
          data: { ...state.data, aspect_ratio: event.aspectRatio },
        };
      }
      return state;
    }

    // Stage 3 — Format / Theme / Style
    case 'curators_pick_or_manual': {
      if (event.type === 'curator_pick_chosen') {
        // All three are locked from the curator's pick; 3.1.5 lets the user
        // swap the style but keeps format + theme.
        return {
          stage: 'curator_style_confirm',
          data: {
            ...state.data,
            curators_pick_id: event.curatorsPickId,
            format_id: event.formatId,
            theme_id: event.themeId,
            style_id: event.styleId,
          },
        };
      }
      if (event.type === 'manual_path_chosen') {
        return {
          stage: 'format_pick',
          data: {
            ...state.data,
            // clear any curator-pick from a previous walk
            curators_pick_id: null,
          },
        };
      }
      return state;
    }

    case 'curator_style_confirm': {
      if (event.type === 'curator_style_kept') {
        return { ...state, stage: 'combination_preview_render' };
      }
      if (event.type === 'curator_style_switched') {
        return {
          stage: 'combination_preview_render',
          data: { ...state.data, style_id: event.styleId },
        };
      }
      return state;
    }

    case 'format_pick': {
      if (event.type === 'format_chosen') {
        return {
          stage: 'theme_category_pick',
          data: { ...state.data, format_id: event.formatId },
        };
      }
      return state;
    }

    case 'theme_category_pick': {
      if (event.type === 'theme_category_chosen') {
        return {
          stage: 'theme_pick',
          data: { ...state.data, pending_theme_category: event.categoryId },
        };
      }
      return state;
    }

    case 'theme_pick': {
      if (event.type === 'theme_chosen') {
        return {
          stage: 'style_pick',
          data: { ...state.data, theme_id: event.themeId },
        };
      }
      return state;
    }

    case 'style_pick': {
      if (event.type === 'style_chosen') {
        return {
          stage: 'combination_preview_render',
          // Clear a stale preview when the user changes the style — the next
          // render call will produce a fresh asset to land on.
          data: {
            ...state.data,
            style_id: event.styleId,
            combination_preview: null,
          },
        };
      }
      return state;
    }

    case 'combination_preview_render': {
      if (event.type === 'preview_rendered') {
        return {
          stage: 'combination_preview_review',
          data: { ...state.data, combination_preview: event.asset },
        };
      }
      return state;
    }

    case 'combination_preview_review': {
      if (event.type === 'preview_approved') {
        return { ...state, stage: 'stage_3_complete' };
      }
      if (event.type === 'preview_restart_style') {
        return {
          stage: 'style_pick',
          data: { ...state.data, combination_preview: null },
        };
      }
      if (event.type === 'preview_restart_theme') {
        return {
          stage: 'theme_category_pick',
          data: {
            ...state.data,
            theme_id: null,
            pending_theme_category: null,
            combination_preview: null,
          },
        };
      }
      if (event.type === 'preview_restart_all') {
        return {
          stage: 'curators_pick_or_manual',
          data: {
            ...state.data,
            curators_pick_id: null,
            format_id: null,
            theme_id: null,
            style_id: null,
            pending_theme_category: null,
            combination_preview: null,
          },
        };
      }
      return state;
    }

    case 'stage_3_complete': {
      // Hand-off into Stage 4: the user taps "Start the beat sheet" which
      // fires `beat_sheet_render_started` and lands them on the render
      // (generation in flight) screen.
      if (event.type === 'beat_sheet_render_started') {
        return { ...state, stage: 'beat_sheet_render' };
      }
      return state;
    }

    // Stage 4 — Beat Sheet
    case 'beat_sheet_render': {
      if (event.type === 'beat_sheet_rendered') {
        return {
          stage: 'beat_sheet_review',
          data: { ...state.data, beat_sheet: event.beats },
        };
      }
      return state;
    }

    case 'beat_sheet_review': {
      if (event.type === 'beat_sheet_edited') {
        // Inline edits — caption / scene_description changes. Stay on review;
        // the PATCH is fired by the BuilderClient side-effect, the reducer
        // just keeps the local copy in sync.
        return {
          ...state,
          data: { ...state.data, beat_sheet: event.beats },
        };
      }
      if (event.type === 'beat_sheet_approved') {
        return { ...state, stage: 'beat_sheet_complete' };
      }
      if (event.type === 'beat_sheet_regenerated') {
        // "Rewrite the whole sheet" — clear the local copy so the loading
        // screen renders cleanly, and bounce back to render. The BuilderClient
        // assigns a fresh Idempotency-Key on this transition.
        return {
          stage: 'beat_sheet_render',
          data: { ...state.data, beat_sheet: null },
        };
      }
      return state;
    }

    case 'beat_sheet_complete': {
      // Hand-off into Stage 5: tapping "Start the storyboard" fires
      // `storyboard_render_started` and lands the user on the render screen.
      if (event.type === 'storyboard_render_started') {
        return {
          stage: 'storyboard_render',
          data: {
            ...state.data,
            // Defensive: a fresh storyboard render clears any prior frames so
            // the loading state renders cleanly on re-entries.
            storyboard_frames: null,
            reroll_beat_idx: null,
          },
        };
      }
      return state;
    }

    // Stage 5 — Storyboard
    case 'storyboard_render': {
      if (event.type === 'storyboard_rendered') {
        return {
          stage: 'storyboard_review',
          data: {
            ...state.data,
            storyboard_frames: event.frames,
            reroll_beat_idx: null,
          },
        };
      }
      return state;
    }

    case 'storyboard_review': {
      if (event.type === 'storyboard_frame_reroll_started') {
        return {
          stage: 'storyboard_frame_reroll',
          data: { ...state.data, reroll_beat_idx: event.beatIdx },
        };
      }
      if (event.type === 'storyboard_approved') {
        // The approve route locks the storyboard and advances the wizard to
        // Stage 5.5 (Phase 5 entry). `storyboard_complete` is a soft pause
        // screen; the user advances from there by tapping a CTA that lands
        // them on `words_render`. We model both transitions because the spec
        // allows either landing pattern depending on whether the approve
        // route fires `words_render` directly or via the pause screen.
        return { ...state, stage: 'storyboard_complete' };
      }
      return state;
    }

    case 'storyboard_frame_reroll': {
      if (event.type === 'storyboard_frame_rerolled') {
        // Replace the matching frame in place; bounce back to review so the
        // user sees the full grid with the updated frame.
        const frames = state.data.storyboard_frames ?? [];
        const next = frames.map((f) =>
          f.beat_idx === event.frame.beat_idx ? event.frame : f,
        );
        return {
          stage: 'storyboard_review',
          data: {
            ...state.data,
            storyboard_frames: next,
            reroll_beat_idx: null,
          },
        };
      }
      // The user can also bail out of a reroll without committing — the UI
      // dispatches `goto: storyboard_review`, which is handled at the top.
      return state;
    }

    case 'storyboard_complete': {
      // Hand-off into Stage 5.5 (Phase 5 entry — placeholder). The user taps
      // "Start The Words" which fires `storyboard_approved`; we use that
      // event because the approve route was already called when entering
      // `storyboard_complete` — keeping the same event name keeps the state
      // machine's edge-set small.
      if (event.type === 'storyboard_approved') {
        return { ...state, stage: 'words_render' };
      }
      return state;
    }

    // Stage 5.5 — The Words. `words_render` is the entry tag; `words_editor`
    // is an alias for deep-links. Both stages accept the same events; the
    // editor IS the render screen (no separate loading panel — the pre-fill
    // defaults are computed client-side).
    case 'words_render':
    case 'words_editor': {
      if (event.type === 'words_loaded') {
        return {
          ...state,
          data: {
            ...state.data,
            opening_title_card_text: event.openingText,
            closing_card_text: event.closingText,
            music_track_id: event.musicTrackId,
            narration_voice_id: event.narrationVoiceId,
            narration_text: event.narrationText,
          },
        };
      }
      if (event.type === 'words_updated') {
        return {
          ...state,
          data: { ...state.data, ...event.patch },
        };
      }
      if (event.type === 'words_approved') {
        return { ...state, stage: 'words_complete' };
      }
      return state;
    }

    case 'words_complete': {
      // Soft pause between The Words and Card Preview. The user advances by
      // tapping the CTA which fires `card_preview_render_started`. We accept
      // `words_approved` here too — the BuilderClient's PATCH path may emit
      // it after a delayed network confirm and we want the reducer to be
      // tolerant.
      if (event.type === 'card_preview_render_started') {
        return {
          stage: 'card_preview_render',
          data: { ...state.data, card_preview_cards: null },
        };
      }
      if (event.type === 'words_approved') return state;
      return state;
    }

    // Stage 5.6 — Card preview render → review → approve.
    case 'card_preview_render': {
      if (event.type === 'card_preview_rendered') {
        return {
          stage: 'card_preview_review',
          data: { ...state.data, card_preview_cards: event.cards },
        };
      }
      return state;
    }

    case 'card_preview_review': {
      if (event.type === 'card_preview_approved') {
        return { ...state, stage: 'card_preview_complete' };
      }
      if (event.type === 'card_preview_restart_words') {
        // "Edit the words" — bounce back to the Words editor, keep the
        // already-set values so the user doesn't have to retype anything.
        // The cards themselves are cleared so the next render is fresh.
        return {
          stage: 'words_editor',
          data: { ...state.data, card_preview_cards: null },
        };
      }
      if (event.type === 'card_preview_restart_all') {
        // "Start over" — kicks back further (bouncing the user all the way
        // to storyboard_complete is the agreed-upon "start over" target for
        // Stage 5.5/5.6 per spec §5.6.2). Words choices stay in state so a
        // re-entry pre-fills with the user's last picks.
        return {
          stage: 'storyboard_complete',
          data: { ...state.data, card_preview_cards: null },
        };
      }
      return state;
    }

    case 'card_preview_complete': {
      // Hand-off into Stage 5.7 cinematography brief (Phase 6 entry).
      if (event.type === 'card_preview_approved') {
        return { ...state, stage: 'cinematography_brief' };
      }
      return state;
    }

    // Stage 5.7 — Cinematography Engine.
    case 'cinematography_brief': {
      // DP overlay picker. The user picks an overlay, then taps "Apply this
      // look." We only persist the overlay choice in state on submit (the
      // picker UI holds the in-progress selection locally).
      if (event.type === 'cinematography_overlay_chosen') {
        return {
          ...state,
          data: { ...state.data, cinematography_dp_overlay: event.overlay },
        };
      }
      if (event.type === 'cinematography_derive_started') {
        return {
          stage: 'cinematography_render',
          data: {
            ...state.data,
            cinematography_dp_overlay: event.overlay,
            // Clear any prior result so the loading state renders cleanly
            // on a re-derivation.
            cinematography_frame_vision: null,
            cinematography_briefs: null,
          },
        };
      }
      return state;
    }

    case 'cinematography_render': {
      if (event.type === 'cinematography_derived') {
        return {
          stage: 'cinematography_review',
          data: {
            ...state.data,
            cinematography_frame_vision: event.frame_vision,
            cinematography_briefs: event.briefs,
          },
        };
      }
      return state;
    }

    case 'cinematography_review': {
      if (event.type === 'cinematography_field_edited') {
        // Replace the matching brief row in place. The reducer is pure —
        // the BuilderClient fires the PATCH and dispatches this with the
        // returned (or optimistically updated) brief.
        const briefs = state.data.cinematography_briefs ?? [];
        const next = briefs.map((b) =>
          b.beat_idx === event.beatIdx ? event.brief : b,
        );
        return {
          ...state,
          data: { ...state.data, cinematography_briefs: next },
        };
      }
      if (event.type === 'cinematography_approved') {
        return { ...state, stage: 'cinematography_complete' };
      }
      if (event.type === 'cinematography_derive_started') {
        // "Reapply derivation" — re-run the engine with the same (or a
        // changed) overlay. Clears briefs so the loading state renders cleanly.
        return {
          stage: 'cinematography_render',
          data: {
            ...state.data,
            cinematography_dp_overlay: event.overlay,
            cinematography_frame_vision: null,
            cinematography_briefs: null,
          },
        };
      }
      if (event.type === 'cinematography_restart') {
        // "Start over" — bounce back to the picker, clear overlay + briefs.
        return {
          stage: 'cinematography_brief',
          data: {
            ...state.data,
            cinematography_dp_overlay: null,
            cinematography_frame_vision: null,
            cinematography_briefs: null,
          },
        };
      }
      return state;
    }

    case 'cinematography_complete': {
      // Soft pause before Phase 7 entry. Tapping "Start the video render"
      // advances into `video_render`, which the BuilderClient hooks to kick
      // off POST /api/video/render and begin polling.
      if (event.type === 'video_render_started') {
        return {
          stage: 'video_render',
          data: { ...state.data, video_clips: null },
        };
      }
      return state;
    }

    // Stage 6 — Video render.
    //
    // The user lands here and the BuilderClient fires /api/video/render, then
    // polls /api/video/status every 5s. The reducer accepts:
    //   - video_status_polled: replace the canonical clips array.
    //   - video_clip_rerolled: replace one clip in place.
    //   - all_clips_done: advance to assembly_render (the user-visible
    //     "stitching…" screen).
    case 'video_render': {
      if (event.type === 'video_status_polled') {
        return {
          ...state,
          data: { ...state.data, video_clips: event.clips },
        };
      }
      if (event.type === 'video_clip_rerolled') {
        const clips = state.data.video_clips ?? [];
        const next = clips.map((c) =>
          c.beat_idx === event.clip.beat_idx ? event.clip : c,
        );
        return {
          ...state,
          data: { ...state.data, video_clips: next },
        };
      }
      if (event.type === 'all_clips_done') {
        return { ...state, stage: 'assembly_render' };
      }
      return state;
    }

    // Stage 6 (review pause). Currently unused in the happy path — the
    // BuilderClient transitions video_render → assembly_render directly on
    // all_clips_done — but kept as a distinct stage so a future "Review the
    // clips before stitching" pill can land here without a stage-tag migration.
    case 'video_review': {
      if (event.type === 'video_status_polled') {
        return {
          ...state,
          data: { ...state.data, video_clips: event.clips },
        };
      }
      if (event.type === 'video_clip_rerolled') {
        const clips = state.data.video_clips ?? [];
        const next = clips.map((c) =>
          c.beat_idx === event.clip.beat_idx ? event.clip : c,
        );
        return {
          ...state,
          data: { ...state.data, video_clips: next },
        };
      }
      if (event.type === 'assembly_started') {
        return { ...state, stage: 'assembly_render' };
      }
      return state;
    }

    // Stage 7 — Assembly render.
    case 'assembly_render': {
      if (event.type === 'assembly_complete_event') {
        return {
          stage: 'assembly_review',
          data: {
            ...state.data,
            assembly_asset_id: event.assetId,
            assembly_public_url: event.publicUrl,
          },
        };
      }
      return state;
    }

    // Stage 7 — Assembly review. The final MP4 + GateReview pills.
    case 'assembly_review': {
      if (event.type === 'assembly_approved') {
        return { ...state, stage: 'assembly_complete' };
      }
      return state;
    }

    case 'assembly_complete': {
      // Soft pause before Phase 8 entry. The CTA dispatches
      // `eulogy_render_started` and lands the user on the render loading panel.
      if (event.type === 'eulogy_render_started') {
        return {
          stage: 'eulogy_render',
          data: { ...state.data, eulogy_pdf_url: null },
        };
      }
      return state;
    }

    // Stage 8 — Eulogy PDF.
    case 'eulogy_render': {
      if (event.type === 'eulogy_rendered') {
        return {
          stage: 'eulogy_review',
          data: {
            ...state.data,
            eulogy_pdf_asset_id: event.assetId,
            eulogy_pdf_url: event.publicUrl,
          },
        };
      }
      return state;
    }

    case 'eulogy_review': {
      if (event.type === 'eulogy_approved') {
        return { ...state, stage: 'eulogy_complete' };
      }
      if (event.type === 'eulogy_render_started') {
        // "Re-render the PDF" — clear the locally cached URL so the loading
        // state renders cleanly, bounce back to render so the auto-fire
        // effect kicks the request.
        return {
          stage: 'eulogy_render',
          data: {
            ...state.data,
            eulogy_pdf_asset_id: null,
            eulogy_pdf_url: null,
          },
        };
      }
      return state;
    }

    case 'eulogy_complete': {
      // Soft pause between Stage 8 and Phase 9 (final delivery). The CTA
      // dispatches `delivery_finalize_started` which moves the user to
      // delivery_ready and the BuilderClient fires the finalize call.
      if (event.type === 'delivery_finalize_started') {
        return { ...state, stage: 'delivery_ready' };
      }
      return state;
    }

    // Phase 9 — Final delivery.
    case 'delivery_ready': {
      if (event.type === 'delivery_finalized') {
        return {
          ...state,
          data: {
            ...state.data,
            delivery_share_slug: event.shareSlug,
            delivery_share_url: event.shareUrl,
          },
        };
      }
      if (event.type === 'delivery_emailed_event') {
        // Email-send success — record the recipient locally so the form can
        // surface a "Sent to <addr>" confirmation. Stay on the same screen;
        // the user may want to send to a second address.
        return {
          stage: 'delivery_emailed',
          data: { ...state.data, delivery_emailed_to: event.sentTo },
        };
      }
      return state;
    }

    case 'delivery_emailed': {
      if (event.type === 'delivery_emailed_event') {
        // Allow additional sends — replace the recipient and stay here.
        return {
          ...state,
          data: { ...state.data, delivery_emailed_to: event.sentTo },
        };
      }
      return state;
    }

    default: {
      // Exhaustiveness check
      const _exhaustive: never = state.stage;
      void _exhaustive;
      return state;
    }
  }
}

// -----------------------------------------------------------------------------
// All known stage tags, derived as a runtime array for membership checks.
// Keep in sync with the `StageTag` union above.
// -----------------------------------------------------------------------------

export const ALL_STAGE_TAGS = [
  // Stage 1 — Intake
  'intake_welcome',
  'intake_returning_user_check',
  'intake_photos',
  'intake_name',
  'intake_name_pronunciation',
  'intake_vision_review',
  'intake_memory',
  'intake_memory_freetext',
  'intake_gender',
  'intake_relationship',
  'intake_traits',
  'intake_favorites',
  'intake_creator',
  'intake_years',
  'intake_complete',
  // Stage 2 — Character sheet
  'character_sheet_render',
  'character_sheet_review',
  'character_sheet_refinement',
  'length_pick',
  'aspect_pick',
  // Stage 3 — Format/Theme/Style
  'curators_pick_or_manual',
  'curator_style_confirm',
  'format_pick',
  'theme_category_pick',
  'theme_pick',
  'style_pick',
  'combination_preview_render',
  'combination_preview_review',
  'stage_3_complete',
  // Stage 4 — Beat Sheet
  'beat_sheet_render',
  'beat_sheet_review',
  'beat_sheet_complete',
  // Stage 5 — Storyboard
  'storyboard_render',
  'storyboard_review',
  'storyboard_frame_reroll',
  'storyboard_complete',
  // Stage 5.5 — The Words
  'words_render',
  'words_editor',
  'words_complete',
  // Stage 5.6 — Card preview
  'card_preview_render',
  'card_preview_review',
  'card_preview_complete',
  // Stage 5.7 — Cinematography Engine
  'cinematography_brief',
  'cinematography_render',
  'cinematography_review',
  'cinematography_complete',
  // Stage 6 — Video clips
  'video_render',
  'video_review',
  // Stage 7 — Assembly
  'assembly_render',
  'assembly_review',
  'assembly_complete',
  // Stage 8 — Eulogy PDF
  'eulogy_render',
  'eulogy_review',
  'eulogy_complete',
  // Phase 9 — Final delivery
  'delivery_ready',
  'delivery_emailed',
] as const satisfies readonly StageTag[];

const STAGE_TAG_SET: ReadonlySet<string> = new Set<string>(ALL_STAGE_TAGS);

export function isStageTag(value: unknown): value is StageTag {
  return typeof value === 'string' && STAGE_TAG_SET.has(value);
}

// -----------------------------------------------------------------------------
// legalNextStages — derived from the reducer.
//
// Returns the set of stages reachable from `current` via *any* non-`goto`,
// non-`session_loaded` event. Used by the server-side PATCH validator to reject
// illegal skip-ahead. The reducer remains the single source of truth — this
// helper just enumerates its outputs without duplicating transition tables.
//
// Same-stage is always legal (idempotent PATCH). `intake_welcome` allows
// `intake_photos` as a forward edge (the welcome screen also hosts the photo
// uploader below the panel — see reducer's `photos_uploaded` case).
// -----------------------------------------------------------------------------

const PROBE_EVENTS: WizardEvent[] = [
  { type: 'start_intake' },
  { type: 'returning_user_answered', isReturning: false },
  { type: 'returning_user_answered', isReturning: true },
  { type: 'photos_uploaded', photos: [] },
  { type: 'photos_skipped' },
  { type: 'name_submitted', petName: 'probe', pronunciationNeeded: false },
  { type: 'name_submitted', petName: 'probe', pronunciationNeeded: true },
  { type: 'pronunciation_submitted', pronunciation: null },
  { type: 'vision_pass_complete', profile: {} },
  { type: 'vision_pass_failed' },
  { type: 'profile_confirmed' },
  { type: 'memory_prompt_chosen', promptId: 'sound_smell_feeling' },
  { type: 'memory_answered', promptId: null, answer: null },
  { type: 'memory_skipped' },
  { type: 'gender_chosen', gender: 'male' },
  { type: 'relationship_chosen', relationship: 'childhood' },
  { type: 'traits_chosen', traits: [] },
  { type: 'favorites_chosen', favorites: [] },
  { type: 'creator_submitted', creatorName: null },
  { type: 'years_submitted', yearsLabel: null },
  // Stage 2 transitions
  { type: 'character_sheet_render_started' },
  {
    type: 'character_sheet_rendered',
    asset: { asset_id: 'probe', public_url: 'probe' },
  },
  { type: 'character_sheet_approved' },
  {
    type: 'character_sheet_refinement_requested',
    refinements: [],
    notes: null,
  },
  { type: 'character_sheet_restart' },
  { type: 'length_chosen', targetMinutes: 3, beatCount: 12 },
  { type: 'aspect_chosen', aspectRatio: '9:16' },
  // Stage 3 transitions
  {
    type: 'curator_pick_chosen',
    curatorsPickId: 'probe',
    formatId: 'probe',
    themeId: 'probe',
    styleId: 'probe',
  },
  { type: 'manual_path_chosen' },
  { type: 'curator_style_kept' },
  { type: 'curator_style_switched', styleId: 'probe' },
  { type: 'format_chosen', formatId: 'probe' },
  { type: 'theme_category_chosen', categoryId: 'probe' },
  { type: 'theme_chosen', themeId: 'probe' },
  { type: 'style_chosen', styleId: 'probe' },
  {
    type: 'preview_rendered',
    asset: { asset_id: 'probe', public_url: 'probe' },
  },
  { type: 'preview_approved' },
  { type: 'preview_restart_style' },
  { type: 'preview_restart_theme' },
  { type: 'preview_restart_all' },
  // Stage 4 transitions
  { type: 'beat_sheet_render_started' },
  { type: 'beat_sheet_rendered', beats: [] },
  { type: 'beat_sheet_edited', beats: [] },
  { type: 'beat_sheet_approved' },
  { type: 'beat_sheet_regenerated' },
  // Stage 5 transitions
  { type: 'storyboard_render_started' },
  { type: 'storyboard_rendered', frames: [] },
  { type: 'storyboard_frame_reroll_started', beatIdx: 0 },
  {
    type: 'storyboard_frame_rerolled',
    frame: { beat_idx: 0, asset_id: 'probe', public_url: 'probe' },
  },
  { type: 'storyboard_approved' },
  // Stage 5.5 — The Words
  {
    type: 'words_loaded',
    openingText: null,
    closingText: null,
    musicTrackId: null,
    narrationVoiceId: null,
    narrationText: null,
  },
  { type: 'words_updated', patch: {} },
  { type: 'words_approved' },
  // Stage 5.6 — Card preview
  { type: 'card_preview_render_started' },
  { type: 'card_preview_rendered', cards: [] },
  { type: 'card_preview_approved' },
  { type: 'card_preview_restart_words' },
  { type: 'card_preview_restart_all' },
  // Stage 5.7 — Cinematography Engine
  { type: 'cinematography_overlay_chosen', overlay: 'none' },
  { type: 'cinematography_derive_started', overlay: 'none' },
  { type: 'cinematography_derived', frame_vision: [], briefs: [] },
  {
    type: 'cinematography_field_edited',
    beatIdx: 0,
    brief: {
      beat_idx: 0,
      lens_mm: 50,
      lens_character: 'standard',
      camera_move: 'locked_off',
      move_intensity: 'gentle',
      subject_motion: 'breath_only',
      lighting_motion: 'static',
      dof_behavior: 'locked_shallow',
      shot_structure: 'single_sustained',
      ambient_audio: 'silence',
      audio_intensity: 'bed_only',
    },
  },
  { type: 'cinematography_approved' },
  { type: 'cinematography_restart' },
  // Stage 6 — Video render
  { type: 'video_render_started' },
  { type: 'video_status_polled', clips: [] },
  {
    type: 'video_clip_rerolled',
    clip: {
      beat_idx: 0,
      status: 'queued',
      asset_id: null,
      public_url: null,
    },
  },
  { type: 'all_clips_done' },
  // Stage 7 — Assembly
  { type: 'assembly_started' },
  {
    type: 'assembly_complete_event',
    assetId: 'probe',
    publicUrl: 'probe',
  },
  { type: 'assembly_approved' },
  // Stage 8 — Eulogy PDF
  { type: 'eulogy_render_started' },
  { type: 'eulogy_rendered', assetId: 'probe', publicUrl: 'probe' },
  { type: 'eulogy_approved' },
  // Phase 9 — Final delivery
  { type: 'delivery_finalize_started' },
  { type: 'delivery_finalized', shareSlug: 'probe', shareUrl: 'probe' },
  { type: 'delivery_emailed_event', sentTo: 'probe@example.com' },
];

export function legalNextStages(current: StageTag): Set<StageTag> {
  const seen = new Set<StageTag>([current]);
  const probeState: WizardState = {
    stage: current,
    data: { ...INITIAL_WIZARD_DATA },
  };
  for (const ev of PROBE_EVENTS) {
    const next = reduceState(probeState, ev);
    if (next.stage !== current) seen.add(next.stage);
  }
  return seen;
}

// -----------------------------------------------------------------------------
// Helper: relationship-driven Curator's Pick reorder.
//
// Per spec §3.1, the Curator's Pick whose `id` matches the user's relationship
// `curators_pick_priority` is moved to position #1 — the rest follow in their
// default library order. The pure-function lives here so it can be unit-tested
// without touching the library content, and so the UI doesn't have to
// duplicate the matching logic.
// -----------------------------------------------------------------------------

export type ReorderablePick = { id: string };

/**
 * Reorder a Curator's Pick list so the pick with id === `priorityId` is at
 * position #0. Stable for the remaining picks. If no match, returns the input
 * order unchanged.
 */
export function reorderCuratorPicks<T extends ReorderablePick>(
  picks: ReadonlyArray<T>,
  priorityId: string | null | undefined,
): T[] {
  if (!priorityId) return [...picks];
  const matchIdx = picks.findIndex((p) => p.id === priorityId);
  if (matchIdx <= 0) return [...picks];
  const next = [...picks];
  const [match] = next.splice(matchIdx, 1);
  next.unshift(match);
  return next;
}

// -----------------------------------------------------------------------------
// Helper: which stage belongs to which top-level stage banner?
// -----------------------------------------------------------------------------

export function bannerKeyForStage(
  stage: StageTag,
):
  | 'intake'
  | 'character_sheet'
  | 'format_theme_style'
  | 'beat_sheet'
  | 'storyboard'
  | 'words'
  | 'card_preview'
  | 'cinematography'
  | 'video'
  | 'assembly'
  | 'eulogy'
  | 'delivery' {
  if (stage.startsWith('intake_')) return 'intake';
  if (
    stage.startsWith('character_sheet_') ||
    stage === 'length_pick' ||
    stage === 'aspect_pick'
  ) {
    return 'character_sheet';
  }
  if (stage.startsWith('beat_sheet_')) return 'beat_sheet';
  if (stage.startsWith('storyboard_')) {
    return 'storyboard';
  }
  if (
    stage === 'words_render' ||
    stage === 'words_editor' ||
    stage === 'words_complete'
  ) {
    return 'words';
  }
  if (
    stage === 'card_preview_render' ||
    stage === 'card_preview_review' ||
    stage === 'card_preview_complete'
  ) {
    return 'card_preview';
  }
  if (
    stage === 'cinematography_brief' ||
    stage === 'cinematography_render' ||
    stage === 'cinematography_review' ||
    stage === 'cinematography_complete'
  ) {
    return 'cinematography';
  }
  if (stage === 'video_render' || stage === 'video_review') {
    return 'video';
  }
  if (
    stage === 'assembly_render' ||
    stage === 'assembly_review' ||
    stage === 'assembly_complete'
  ) {
    return 'assembly';
  }
  if (
    stage === 'eulogy_render' ||
    stage === 'eulogy_review' ||
    stage === 'eulogy_complete'
  ) {
    return 'eulogy';
  }
  if (stage === 'delivery_ready' || stage === 'delivery_emailed') {
    return 'delivery';
  }
  return 'format_theme_style';
}
