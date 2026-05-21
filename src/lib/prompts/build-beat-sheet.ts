// Beat sheet prompt builder — Stage 4.
//
// Composes the GPT-4o prompt + strict JSON schema for generating the N-beat
// arc that drives the rest of the tribute. The output is N BeatWire objects
// — one per beat — with archetype, scene_description, caption, optional notes.
//
// Caption voice is selected from the format's `caption_voice` field (e.g.
// `letter_to_my_pet` → first-person owner-to-pet). Caption length is ≤15
// words and the pet's name appears at most once across the full arc per spec.

import type { ArtStyle } from '@/lib/library/art-styles';
import { captionSuggestionsFor } from '@/lib/library/caption-templates';
import type { Format } from '@/lib/library/formats';
import type { SessionWire } from '@/lib/builder/wire-types';
import type { Theme } from '@/lib/library/themes';

export type BeatSheetSchema = Record<string, unknown>;

export type BuildBeatSheetInput = {
  session: SessionWire;
  format: Format;
  theme: Theme;
  style: ArtStyle;
  beatCount: 8 | 12 | 16;
};

export type BuildBeatSheetOutput = {
  prompt: string;
  schema: BeatSheetSchema;
};

/**
 * Beat archetype templates by length. The 8-beat arc is the canonical
 * emotional structure; 12 and 16 extend by adding extension beats between
 * the core archetypes per spec.
 */
const ARCHETYPES_BY_COUNT: Record<8 | 12 | 16, readonly string[]> = {
  8: [
    'opening',
    'rising',
    'first_turning',
    'peak_warmth',
    'second_turning',
    'quiet_moment',
    'descent',
    'closing',
  ],
  12: [
    'opening',
    'rising',
    'companionship',
    'first_turning',
    'mischief',
    'peak_warmth',
    'season_change',
    'second_turning',
    'small_ritual',
    'quiet_moment',
    'descent',
    'closing',
  ],
  16: [
    'opening',
    'rising',
    'companionship',
    'first_turning',
    'mischief',
    'season_change',
    'peak_warmth',
    'peak_warmth',
    'small_ritual',
    'season_change',
    'second_turning',
    'companionship',
    'quiet_moment',
    'quiet_moment',
    'descent',
    'closing',
  ],
};

export function buildBeatSheetPrompt(input: BuildBeatSheetInput): BuildBeatSheetOutput {
  const { session, format, theme, style, beatCount } = input;
  const archetypes = ARCHETYPES_BY_COUNT[beatCount];

  const petName = session.pet_name?.trim() || 'the pet';
  const petGender = session.pet_gender || 'neutral';
  const relationship = session.relationship || 'unspecified';
  const memory = session.memory_prompt_answer?.trim() || '';
  const traits = (session.personality_traits ?? []).join(', ') || '—';
  const favorites = (session.favorite_things ?? []).join(', ') || '—';
  const creatorName = session.creator_name?.trim() || '';
  const yearsLabel = session.years_label?.trim() || '';

  // Per-archetype suggestion bank — gives the model concrete reference
  // phrasings to draw on without forcing exact strings.
  const archetypeSuggestionBlock = archetypes
    .map((arch, idx) => {
      const sugg = captionSuggestionsFor(arch);
      return `Beat ${idx + 1} (${arch}): ${sugg.length ? sugg.map((s) => `"${s}"`).join(' / ') : '— write something true to this pet —'}`;
    })
    .join('\n');

  const prompt = [
    `You are drafting a ${beatCount}-beat tribute arc for ${petName}, a ${petGender === 'neutral' ? 'beloved pet' : petGender + ' pet'}, in the ${format.label} format, ${theme.label} theme, ${style.label} art style.`,
    '',
    `Context from the family:`,
    `- Pet name: ${petName}`,
    `- Pronouns: ${petGender}`,
    `- Relationship: ${relationship}`,
    creatorName ? `- Creator: ${creatorName}` : '',
    yearsLabel ? `- Years: ${yearsLabel}` : '',
    memory ? `- A specific memory the family shared: "${memory}"` : '',
    `- Personality: ${traits}`,
    `- Favorite things: ${favorites}`,
    '',
    `Format directive:`,
    format.visual_archetype,
    '',
    `Theme directive:`,
    theme.scene_description,
    '',
    `Art style directive:`,
    style.directive,
    '',
    `Caption voice for this format: ${format.caption_voice}.`,
    `Beat archetypes (in order):`,
    archetypes.map((a, i) => `${i + 1}. ${a}`).join('\n'),
    '',
    `Per-archetype suggested phrasings (use as inspiration, not as exact text):`,
    archetypeSuggestionBlock,
    '',
    `Constraints (HARD):`,
    `- Each beat's caption MUST be at most 15 words.`,
    `- The pet's name (${petName}) appears at most once across the entire arc — choose where it lands most emotionally.`,
    `- Captions must use the caption voice for this format (${format.caption_voice}).`,
    `- The scene_description for each beat is a long-form prompt for an image generator — describe ONE moment the pet is in, including the environment, light, and posture. NEVER depict illness, injury, death, gravestones, or human faces.`,
    `- The arc must move emotionally from opening through rising warmth, a peak, a gentle descent, and a closing — even when the user's chosen theme is celebratory.`,
    '',
    `Output: a JSON object with a "beats" array of exactly ${beatCount} entries, each with { idx, archetype, scene_description, caption }. Idx is 0-indexed.`,
  ]
    .filter((line) => line !== '')
    .join('\n');

  // Strict JSON schema — OpenAI's structured-output / Gemini's responseSchema
  // both accept the standard subset shown here.
  const schema: BeatSheetSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['beats'],
    properties: {
      beats: {
        type: 'array',
        minItems: beatCount,
        maxItems: beatCount,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['idx', 'archetype', 'scene_description', 'caption'],
          properties: {
            idx: { type: 'integer', minimum: 0, maximum: beatCount - 1 },
            archetype: { type: 'string' },
            scene_description: { type: 'string', minLength: 20 },
            caption: { type: 'string', maxLength: 200 },
            notes: { type: 'string' },
          },
        },
      },
    },
  };

  return { prompt, schema };
}

/** Exported so the route handler can verify input length cheaply. */
export function expectedArchetypes(beatCount: 8 | 12 | 16): readonly string[] {
  return ARCHETYPES_BY_COUNT[beatCount];
}
