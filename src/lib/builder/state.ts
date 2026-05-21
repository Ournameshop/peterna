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
  | 'stage_3_complete';

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

    // Stage 2 + Stage 3 stages: not wired in Phase 1. Reducer accepts them as
    // valid states but events that would advance through them aren't defined
    // yet — return state unchanged.
    case 'intake_complete':
    case 'character_sheet_render':
    case 'character_sheet_review':
    case 'character_sheet_refinement':
    case 'length_pick':
    case 'aspect_pick':
    case 'curators_pick_or_manual':
    case 'curator_style_confirm':
    case 'format_pick':
    case 'theme_category_pick':
    case 'theme_pick':
    case 'style_pick':
    case 'combination_preview_render':
    case 'combination_preview_review':
    case 'stage_3_complete':
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
// Helper: which stage belongs to which top-level stage banner?
// -----------------------------------------------------------------------------

export function bannerKeyForStage(
  stage: StageTag,
): 'intake' | 'character_sheet' | 'format_theme_style' {
  if (stage.startsWith('intake_')) return 'intake';
  if (
    stage.startsWith('character_sheet_') ||
    stage === 'length_pick' ||
    stage === 'aspect_pick'
  ) {
    return 'character_sheet';
  }
  return 'format_theme_style';
}
