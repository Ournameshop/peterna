// Narration-voice library — Phase 5 (Stage 5.5.5).
//
// Transcribed verbatim from the spec's embedded library YAML
// (`SKILL (5).md` §EMBEDDED ASSET LIBRARY → `narration_voices:`, line 2087).
//
// Phase 5 only stores the chosen `id` on the session row
// (`sessions.narration_voice_id`) and the optional letter body on
// `sessions.narration_text`. The actual ElevenLabs TTS call is deferred to
// Phase 7 (Stage 7.4 — see spec line 1197); the `eleven_labs_voice_id` here
// is the contract for that downstream call.

import type { ArtStyleId } from './art-styles';

export type NarrationVoiceId =
  | 'warm_female_alto'
  | 'warm_male_baritone'
  | 'soft_female_mezzo'
  | 'user_recorded';

export type NarrationVoice = {
  readonly id: NarrationVoiceId;
  /** Pill label shown on the picker. */
  readonly label: string;
  /** 1-line description shown beneath the label. */
  readonly secondary: string;
  /**
   * The downstream ElevenLabs voice id. `null` for the user-recorded path
   * (the user uploads audio directly; no TTS round-trip). `[TBD]` per the
   * spec for the first three — Phase 7 wires real ids once voices are
   * commissioned.
   */
  readonly eleven_labs_voice_id: string | null;
  /** Art-style IDs this voice is recommended for. Informational only. */
  readonly default_for: ReadonlyArray<ArtStyleId>;
};

export const NARRATION_VOICES: ReadonlyArray<NarrationVoice> = [
  {
    id: 'warm_female_alto',
    label: 'Warm female alto',
    secondary: 'Soft, intimate, slightly breathy. Best for tender letter delivery.',
    eleven_labs_voice_id: '[TBD]',
    default_for: ['watercolor', 'storybook_illustration'],
  },
  {
    id: 'warm_male_baritone',
    label: 'Warm male baritone',
    secondary: 'Gentle, steady, lower register. Best for ceremonial tributes.',
    eleven_labs_voice_id: '[TBD]',
    default_for: ['cinematic_realism'],
  },
  {
    id: 'soft_female_mezzo',
    label: 'Soft female mezzo',
    secondary: 'Mid-register warmth, conversational.',
    eleven_labs_voice_id: '[TBD]',
    default_for: [],
  },
  {
    id: 'user_recorded',
    label: 'My own voice',
    secondary: 'Record and upload your own narration audio.',
    eleven_labs_voice_id: null,
    default_for: [],
  },
] as const;

const VOICE_BY_ID = new Map<NarrationVoiceId, NarrationVoice>(
  NARRATION_VOICES.map((v) => [v.id, v]),
);

export function findNarrationVoice(
  id: NarrationVoiceId | string | null | undefined,
): NarrationVoice | undefined {
  if (!id) return undefined;
  return VOICE_BY_ID.get(id as NarrationVoiceId);
}
