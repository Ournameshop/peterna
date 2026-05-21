// Combination-preview prompt builder.
//
// Stage 3.5 of the spec (`SKILL (5).md` §"Stage 3 — Format, Theme & Style",
// subsection 3.5 at line 790): render ONE preview frame of the user's pet in
// the chosen format + theme + style. The character sheet is the canonical
// likeness reference — the original pet photos are NOT passed here. This is
// the load-bearing simplification that lets downstream stages stay cheap:
// once the character sheet is approved, every subsequent prompt references
// the same one image and the likeness stays locked.
//
// Pure function: no I/O, no Date.now. Same input → same output.
//
// TODO(phase 4+): the beat-sheet pipeline will inject per-beat caption
// directives here so the combination preview can include the format-paired
// caption voice and the opening title-card text. For Phase 3 the preview is
// caption-free — the user is confirming the *visual register*, not the
// typography.

import type { ArtStyle } from '@/lib/library/art-styles';
import type { Format } from '@/lib/library/formats';
import type { Theme } from '@/lib/library/themes';
import type { SessionWire } from '@/lib/builder/wire-types';

/**
 * Locked verbatim per spec §"Likeness reference rule (HARD)" (line 172) and
 * `risk-register.md` Risk #1. Phase 2's character-sheet builder uses the same
 * sentence with "from the reference photos" (multi-photo). Here, the character
 * sheet itself is the canonical likeness — wording adapts to "the reference photo"
 * (singular) to match the single asset passed as a reference.
 */
export const LIKENESS_REFERENCE_SENTENCE_TEMPLATE =
  'Replicate the exact likeness, markings, proportions, and distinguishing features of [PET_NAME] from the reference photo. Do not invent any other animal.';

/**
 * Hard exclusions appended to every prompt. Matches `build-character-sheet.ts`
 * so the safety contract is identical at every stage.
 */
export const HARD_EXCLUSIONS = [
  'No humans in frame.',
  'No medical equipment, no illness, no injury, no death, no distressing imagery — only living, peaceful, and dignified depictions.',
  'No text, no labels, no watermarks.',
];

export type BuildPreviewInput = {
  /** Session row (snake_case wire shape). Reads `pet_name`, `aspect_ratio`. */
  session: Pick<SessionWire, 'pet_name' | 'aspect_ratio'>;
  /** S3 public URL of the locked `kind='character_sheet'` asset. The only reference. */
  charSheetUrl: string;
  /** Chosen format (looked up by id in the route). Provides `visual_archetype`. */
  format: Format;
  /** Chosen theme (looked up by id in the route). Provides `scene_description`. */
  theme: Theme;
  /** Chosen art style (looked up by id in the route). Provides `directive`. */
  style: ArtStyle;
};

export type BuildPreviewOutput = {
  prompt: string;
  references: Array<{ url: string; role: 'subject' }>;
};

/**
 * Build the Stage-3.5 combination-preview prompt + references payload. Pure.
 *
 * Structure (in order):
 *   1. Locked likeness-reference sentence (substitutes [PET_NAME]).
 *   2. Format visual archetype — the kind of tribute and how it composes.
 *   3. Theme scene description — the world the frame lives in.
 *   4. Art style directive — the visual register / painting language.
 *   5. Hard exclusions (no humans, no illness, no text).
 *   6. Aspect-ratio framing instruction.
 *
 * The character sheet is passed as the SOLE reference. The user's original
 * pet photos are not — once the character sheet is approved, it is the
 * canonical likeness for every downstream render.
 */
export function buildPreviewPrompt(input: BuildPreviewInput): BuildPreviewOutput {
  const petName = (input.session.pet_name ?? '').trim() || 'this pet';
  const aspect = normalizeAspect(input.session.aspect_ratio);

  const likenessSentence = LIKENESS_REFERENCE_SENTENCE_TEMPLATE.replace(/\[PET_NAME\]/g, petName);

  // Spec §3.5 prompt template (line 796): the format describes the kind of
  // tribute; the theme describes the world; the style describes the painting
  // language. Composed verbatim from the library directives so a single
  // source-of-truth change (e.g. tweaking a scene_description) flows through.
  const sceneBlock = [
    `A single illustrative still frame for a ${input.format.label} pet tribute in the ${input.theme.label} visual world.`,
    input.format.visual_archetype,
    input.theme.scene_description,
    `${petName} is the sole subject, peacefully present in the scene. Soft gentle lighting.`,
  ].join(' ');

  const styleBlock = `Art style: ${input.style.directive}`;

  const exclusions = HARD_EXCLUSIONS.join(' ');

  const framingBlock = aspectFramingDirective(aspect);

  const sections: string[] = [
    likenessSentence,
    '',
    sceneBlock,
    '',
    styleBlock,
    '',
    exclusions,
    '',
    framingBlock,
  ];

  const prompt = sections.join('\n').trim();

  const references: Array<{ url: string; role: 'subject' }> = [
    { url: input.charSheetUrl, role: 'subject' },
  ];

  return { prompt, references };
}

// ----------------------------------------------------------------------------
// Aspect helpers
// ----------------------------------------------------------------------------

export type NormalizedAspect = '9:16' | '16:9' | '1:1';

/** Best-effort normalization to one of the three master framings. Defaults to 9:16. */
export function normalizeAspect(value: string | null | undefined): NormalizedAspect {
  if (value === '9:16' || value === '16:9' || value === '1:1') return value;
  return '9:16';
}

function aspectFramingDirective(aspect: NormalizedAspect): string {
  switch (aspect) {
    case '9:16':
      return 'Vertical 9:16 composition: the subject is centered in the upper-middle third with breathing room above and below. Suitable for mobile / social viewing.';
    case '16:9':
      return 'Horizontal 16:9 composition: the subject sits in a balanced thirds layout with environmental context on either side. Suitable for TV and family viewing.';
    case '1:1':
      return 'Square 1:1 composition: the subject is centered with even margins. Suitable for social-grid presentation.';
  }
}

/** Map a master aspect to a GPT Image 2 supported size. Phase 3 preview is `quality: medium`. */
export function aspectToImageSize(
  aspect: NormalizedAspect,
): '1024x1024' | '1024x1536' | '1536x1024' {
  switch (aspect) {
    case '9:16':
      return '1024x1536';
    case '16:9':
      return '1536x1024';
    case '1:1':
      return '1024x1024';
  }
}
