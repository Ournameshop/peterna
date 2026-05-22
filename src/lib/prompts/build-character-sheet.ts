// Character-sheet prompt builder.
//
// Stage 2 is the "single failure mode that ruins the tribute" per the spec
// (`docs/tribute-builder/risk-register.md` Risk #1). The likeness-reference
// sentence at the top of every prompt is locked — see `LIKENESS_REFERENCE_SENTENCE`
// below. Do not rephrase, do not reorder.
//
// Pure function: no I/O, no Date.now. Same input → same output.
//
// TODO(frontend agent): the state-machine reducer in `src/lib/builder/state.ts`
// doesn't yet emit Phase-2 events. We need (at minimum) the following added to
// `WizardEvent` and wired through `reduceState`:
//   - `character_sheet_rendered` → carries `{ asset_id, public_url }`, transitions
//     `character_sheet_render` → `character_sheet_review`.
//   - `character_sheet_refinement_requested` → carries `{ corrections: string[] }`,
//     transitions `character_sheet_review` → `character_sheet_refinement`, then
//     back to `character_sheet_render` once the user submits.
//   - `character_sheet_approved` → carries `{ asset_id }`, transitions
//     `character_sheet_review` → `length_pick`.
//   - `length_chosen` → carries `{ beat_count, target_minutes }`, transitions
//     `length_pick` → `aspect_pick`.
//   - `aspect_chosen` → carries `{ aspect_ratio }`, transitions
//     `aspect_pick` → `curators_pick_or_manual`.
// The backend approve route writes the same DB fields directly; the frontend
// reducer is the source of truth for legal transitions on the PATCH path.

import type { InferredProfile, SessionWire } from '@/lib/builder/wire-types';

/**
 * Locked verbatim per spec §"Likeness reference rule (HARD)" (line 172) and
 * `risk-register.md` Risk #1. The skill-runtime sentence references
 * `@character_sheet` (a Higgsfield job ID) — for the web app we pass references
 * inline, so the phrase becomes "from the reference photos."
 *
 * This sentence MUST be the first line of every character-sheet prompt and of
 * every downstream prompt (combination preview, storyboard, video). Tests
 * assert it appears in the output of `buildCharacterSheetPrompt`.
 */
export const LIKENESS_REFERENCE_SENTENCE_TEMPLATE =
  'Replicate the exact likeness, markings, proportions, and distinguishing features of [PET_NAME] from the reference photos. Do not invent any other animal.';

/**
 * Hard exclusions appended to every prompt. Per spec:
 *   - no humans in frame (the tribute focuses on the pet alone unless explicitly composed otherwise)
 *   - no illness, no injury, no death — only living and peaceful depictions
 */
export const HARD_EXCLUSIONS = [
  'No humans in frame.',
  'No medical equipment, no illness, no injury, no death, no distressing imagery — only living, peaceful, and dignified depictions.',
  'No text, no labels, no watermarks.',
];

export type BuildCharacterSheetInput = {
  /** Session row (snake_case wire shape). Reads `pet_name`, `inferred_profile`, `pet_gender`. */
  session: Pick<SessionWire, 'pet_name' | 'pet_gender' | 'inferred_profile'>;
  /**
   * Public S3 URLs of the session's `character_reference` photos. The caller
   * (`/api/character-sheet/render`) is the canonical filter site — it queries
   * for `metadata.photo_role = 'character_reference'` (legacy rows with NULL
   * role count as character_reference per the Phase 15a fallback convention).
   * The builder itself accepts the URLs as a pre-filtered list — see the
   * `with_human` / `environment` carve-out in the architect's plan §1.
   */
  photoUrls: string[];
  /** Stage 2.3 user corrections, appended to the prompt as a bullet list. */
  refinements?: string[];
};

export type BuildCharacterSheetOutput = {
  prompt: string;
  references: Array<{ url: string; role: 'subject' }>;
};

/**
 * Build the Stage-2 character-sheet prompt + references payload. Pure.
 *
 * Structure (in order):
 *   1. Locked likeness-reference sentence (template — substitutes [PET_NAME])
 *   2. 4-view layout instructions (spec §2.1)
 *   3. Profile descriptors (species/breed/coat/age/body) when known from vision pass
 *   4. Hard exclusions (no humans, no illness, no text)
 *   5. Resolution + framing instructions
 *   6. Refinement bullets (only when present — preserves prior render context)
 */
export function buildCharacterSheetPrompt(
  input: BuildCharacterSheetInput,
): BuildCharacterSheetOutput {
  const petName = (input.session.pet_name ?? '').trim() || 'this pet';
  const profile = (input.session.inferred_profile ?? null) as InferredProfile | null;
  const refinements = (input.refinements ?? []).map((r) => r.trim()).filter(Boolean);

  const likenessSentence = LIKENESS_REFERENCE_SENTENCE_TEMPLATE.replace(/\[PET_NAME\]/g, petName);

  // Profile descriptor line — keep terse. Vision-pass fields are optional; degrade gracefully
  // (the photos themselves are the source of truth for likeness).
  const descriptors = composeDescriptors(petName, profile, input.session.pet_gender ?? null);

  const fourViewBlock = [
    `A character reference sheet for ${petName}, 2x2 grid on a clean off-white neutral background, 2K resolution (2048x2048), 1:1 square aspect ratio.`,
    '- Top-left: front-facing portrait, head and shoulders, gentle eye contact with the camera.',
    '- Top-right: full side profile, full body, standing in a neutral relaxed pose.',
    '- Bottom-left: full body, sitting or lying down, alert and content.',
    '- Bottom-right: tight detail study — eyes, face markings, and any distinguishing features (ear shape, coat pattern, distinctive feature).',
    'Soft natural studio lighting. Realistic, warm, alive. No background scenery beyond the clean backdrop.',
  ].join('\n');

  const exclusions = HARD_EXCLUSIONS.join(' ');

  const sections: string[] = [
    likenessSentence,
    '',
    fourViewBlock,
    '',
    descriptors,
    '',
    exclusions,
  ];

  if (refinements.length > 0) {
    sections.push('');
    sections.push('Apply these corrections to the previous render:');
    for (const r of refinements) {
      sections.push(`- ${r}`);
    }
  }

  const prompt = sections.filter((s) => s !== null).join('\n').trim();

  const references: Array<{ url: string; role: 'subject' }> = input.photoUrls.map((url) => ({
    url,
    role: 'subject',
  }));

  return { prompt, references };
}

function composeDescriptors(
  petName: string,
  profile: InferredProfile | null,
  gender: string | null,
): string {
  if (!profile || profile.vision_failure) {
    return `Render ${petName} exactly as shown in the reference photos.`;
  }
  const parts: string[] = [];
  const species = (profile.species ?? '').trim();
  const breed = (profile.breed_guess ?? '').trim();
  const coat = (profile.coat_description ?? '').trim();
  const age = (profile.age_range ?? '').trim();
  const body = (profile.body_type ?? '').trim();

  // Build a single descriptive sentence — keep it grammatical when fields are missing.
  const descriptorClauses: string[] = [];
  if (age) descriptorClauses.push(humanizeAge(age));
  if (body) descriptorClauses.push(`${body}-bodied`);
  if (breed) descriptorClauses.push(breed);
  if (species && !breed) descriptorClauses.push(species);

  if (descriptorClauses.length > 0) {
    parts.push(`${petName} is a ${descriptorClauses.join(' ')}${species && breed ? ` ${species}` : ''}.`);
  }
  if (coat) {
    parts.push(`Coat: ${coat}.`);
  }
  if (gender) {
    parts.push(`Treat as ${gender}.`);
  }
  parts.push(`Match the exact features visible in the reference photos — do not generalize to breed averages.`);

  return parts.join(' ');
}

function humanizeAge(age: string): string {
  switch (age) {
    case 'puppy_kitten':
      return 'young';
    case 'young_adult':
      return 'young-adult';
    case 'adult':
      return 'adult';
    case 'senior':
      return 'senior';
    default:
      return age;
  }
}
