// Phase 5 — Narration voice library.
//
// Mirrors SKILL v2.3 §"narration_voices" (line ~2087). Tone-paired ElevenLabs
// voices for the optional Stage 5.5.5 spoken-letter add-on. Off by default —
// narration is an explicit opt-in.
//
// Seed shape ships here so the Stage 5.5 picker can build green; backend
// agent will replace with production voice IDs (the [TBD] strings in the
// SKILL YAML).

import type { ArtStyleId } from './art-styles';

export type NarrationVoice = {
  readonly id: string;
  /** Label shown on the picker pill. */
  readonly name: string;
  /** Single-line description ("Soft, intimate, slightly breathy"). */
  readonly description: string;
  /** ElevenLabs voice id; `null` for the user-recorded option. */
  readonly elevenlabs_voice_id: string | null;
  /** Art-style ids this voice is the natural default for. */
  readonly default_for: readonly ArtStyleId[];
};

export const NARRATION_VOICES: readonly NarrationVoice[] = [
  {
    id: 'warm_female_alto',
    name: 'Warm female alto',
    description: 'Soft, intimate, slightly breathy. Best for tender letter delivery.',
    elevenlabs_voice_id: null,
    default_for: ['watercolor', 'storybook_illustration'],
  },
  {
    id: 'warm_male_baritone',
    name: 'Warm male baritone',
    description: 'Gentle, steady, lower register. Best for ceremonial tributes.',
    elevenlabs_voice_id: null,
    default_for: ['cinematic_realism'],
  },
  {
    id: 'soft_female_mezzo',
    name: 'Soft female mezzo',
    description: 'Mid-register warmth, conversational.',
    elevenlabs_voice_id: null,
    default_for: [],
  },
  {
    id: 'user_recorded',
    name: 'My own voice',
    description: 'Record your own narration and upload it.',
    elevenlabs_voice_id: null,
    default_for: [],
  },
] as const;

const VOICE_BY_ID = new Map<string, NarrationVoice>(
  NARRATION_VOICES.map((v) => [v.id, v]),
);

export function findNarrationVoice(
  id: string | null | undefined,
): NarrationVoice | undefined {
  if (!id) return undefined;
  return VOICE_BY_ID.get(id);
}

export function defaultNarrationVoiceForStyle(
  styleId: string | null | undefined,
): string | null {
  if (!styleId) return null;
  const match = NARRATION_VOICES.find((v) =>
    (v.default_for as readonly string[]).includes(styleId),
  );
  return match?.id ?? null;
}
