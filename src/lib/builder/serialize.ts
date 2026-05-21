import 'server-only';

import type { Session } from '@/lib/db/schema';
import type { BeatWire, SessionWire } from '@/lib/builder/wire-types';
import type { StageTag } from '@/lib/builder/state';
import type { InferredProfile } from '@/lib/builder/state';

/**
 * Map a Drizzle `Session` row (camelCase, `Date` timestamps, jsonb columns) to the
 * snake_case JSON shape `SessionWire` we ship over the wire.
 *
 * Single place that bridges DB-orient → API-orient. Adding a new column in
 * `schema.ts` requires one addition here AND one to `wire-types.ts`; the types
 * keep both sides honest.
 */
export function serializeSession(s: Session): SessionWire {
  return {
    id: s.id,
    cookie_token: s.cookieToken,
    resume_token: s.resumeToken,
    stage: s.stage as StageTag,
    created_at: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
    updated_at: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : String(s.updatedAt),

    returning_user: s.returningUser,
    pet_name: s.petName,
    pet_name_pronunciation: s.petNamePronunciation,
    pet_gender: s.petGender,
    relationship: s.relationship,
    memory_prompt_type: s.memoryPromptType,
    memory_prompt_answer: s.memoryPromptAnswer,
    personality_traits: s.personalityTraits ?? null,
    favorite_things: s.favoriteThings ?? null,
    creator_name: s.creatorName,
    years_label: s.yearsLabel,

    inferred_profile: (s.inferredProfile as InferredProfile | null) ?? null,
    inferred_confidence:
      (s.inferredConfidence as Record<string, 'high' | 'medium' | 'low'> | null) ?? null,

    beat_count: s.beatCount,
    target_minutes: s.targetMinutes,
    aspect_ratio: s.aspectRatio,

    curators_pick_id: s.curatorsPickId,
    format_id: s.formatId,
    theme_id: s.themeId,
    style_id: s.styleId,

    character_sheet_asset_id: s.characterSheetAssetId,
    combination_preview_asset_id: s.combinationPreviewAssetId,

    beat_sheet: (s.beatSheet as BeatWire[] | null) ?? null,
    beat_sheet_approved_at:
      s.beatSheetApprovedAt instanceof Date
        ? s.beatSheetApprovedAt.toISOString()
        : s.beatSheetApprovedAt
          ? String(s.beatSheetApprovedAt)
          : null,

    storyboard_frame_asset_ids: s.storyboardFrameAssetIds ?? null,
    storyboard_approved_at:
      s.storyboardApprovedAt instanceof Date
        ? s.storyboardApprovedAt.toISOString()
        : s.storyboardApprovedAt
          ? String(s.storyboardApprovedAt)
          : null,

    opening_title_card_text: s.openingTitleCardText,
    closing_card_text: s.closingCardText,
    music_track_id: s.musicTrackId,
    narration_voice_id: s.narrationVoiceId,
    narration_text: s.narrationText,
    card_preview_asset_ids: s.cardPreviewAssetIds ?? null,
    card_preview_approved_at:
      s.cardPreviewApprovedAt instanceof Date
        ? s.cardPreviewApprovedAt.toISOString()
        : s.cardPreviewApprovedAt
          ? String(s.cardPreviewApprovedAt)
          : null,
  };
}
