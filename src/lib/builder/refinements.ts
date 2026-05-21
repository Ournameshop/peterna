// Stage 2.3 — Character sheet refinement chips.
//
// The spec calls out these correction categories but doesn't enumerate exact
// chip labels for the web UI. This module is the source of truth for the
// chip set: each chip has a user-facing `label` (what the grieving user sees)
// and an `instruction` (the imperative-voice line appended to the next
// character-sheet prompt by the backend's `build-character-sheet.ts`).
//
// Tone rules (HARD, from copy-and-content.md):
//   - "Looks like" / "I see" — never asserts, just notes
//   - No cost language, no urgency, no apologetic tone
//   - User-facing label reads as the user's correction, not the model's mistake
//
// Frontend ships the IDs (and the user-visible labels). The backend resolves
// the IDs back to `instruction` strings when assembling the prompt. Keeping
// the instruction text co-located here lets a single PR adjust both.

export type RefinementChipId =
  | 'eyes_color'
  | 'eyes_shape'
  | 'ears_shape'
  | 'coat_pattern'
  | 'coat_color'
  | 'distinctive_markings'
  | 'face_shape'
  | 'body_size'
  | 'pose'
  | 'expression';

export type RefinementChip = {
  readonly id: RefinementChipId;
  readonly label: string;
  readonly instruction: string;
};

export const REFINEMENT_CHIPS: ReadonlyArray<RefinementChip> = [
  {
    id: 'eyes_color',
    label: 'The eyes — a different color',
    instruction:
      'Adjust the eye color to match the reference photos exactly.',
  },
  {
    id: 'eyes_shape',
    label: 'The eyes — a different shape',
    instruction:
      'Adjust the eye shape and spacing to match the reference photos.',
  },
  {
    id: 'ears_shape',
    label: 'The ears',
    instruction:
      'Adjust the ear shape, length, set, and carriage to match the reference photos.',
  },
  {
    id: 'coat_pattern',
    label: 'The coat pattern',
    instruction:
      'Adjust the coat pattern (spots, stripes, patches, parti-color, etc.) to match the reference photos exactly.',
  },
  {
    id: 'coat_color',
    label: 'The coat color',
    instruction:
      'Adjust the coat color and shading to match the reference photos exactly.',
  },
  {
    id: 'distinctive_markings',
    label: 'Distinctive markings',
    instruction:
      'Preserve the distinguishing markings (masks, blazes, socks, chest patches, etc.) exactly as seen in the reference photos.',
  },
  {
    id: 'face_shape',
    label: 'The face shape',
    instruction:
      'Adjust the muzzle length, head shape, and facial proportions to match the reference photos.',
  },
  {
    id: 'body_size',
    label: 'The body size or build',
    instruction:
      'Adjust the body proportions, build, and overall size to match the reference photos.',
  },
  {
    id: 'pose',
    label: 'The pose',
    instruction:
      'Use a more natural, relaxed pose that better reflects the reference photos.',
  },
  {
    id: 'expression',
    label: 'The expression',
    instruction:
      'Adjust the facial expression so it feels alert and content, matching the reference photos.',
  },
] as const;

const CHIPS_BY_ID = new Map(REFINEMENT_CHIPS.map((c) => [c.id, c]));

export function getRefinementChip(id: string): RefinementChip | undefined {
  return CHIPS_BY_ID.get(id as RefinementChipId);
}

export function getRefinementInstructions(ids: ReadonlyArray<string>): string[] {
  return ids
    .map((id) => CHIPS_BY_ID.get(id as RefinementChipId)?.instruction)
    .filter((s): s is string => typeof s === 'string');
}
