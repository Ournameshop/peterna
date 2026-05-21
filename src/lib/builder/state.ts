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
import type { BeatWire, StoryboardFrameWire } from './wire-types';

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
  // Stage 6 placeholder — Stage 5.5 "The Words" entry. The reducer just lands
  // here on storyboard_approved; no further wiring in Phase 4b.
  | 'words_render';

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

    case 'words_render':
      return state;

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
  // Stage 5.5 placeholder
  'words_render',
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
  | 'storyboard' {
  if (stage.startsWith('intake_')) return 'intake';
  if (
    stage.startsWith('character_sheet_') ||
    stage === 'length_pick' ||
    stage === 'aspect_pick'
  ) {
    return 'character_sheet';
  }
  if (stage.startsWith('beat_sheet_')) return 'beat_sheet';
  if (stage.startsWith('storyboard_') || stage === 'words_render') {
    return 'storyboard';
  }
  return 'format_theme_style';
}
