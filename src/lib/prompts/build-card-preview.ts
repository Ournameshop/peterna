// Card-preview prompt builders — Stage 5.6 (v2.3).
//
// Per spec `SKILL (5).md` §"Stage 5.6 — Card preview" (line 1039): render
// three GPT Image 2 stills BEFORE any video clip fires:
//   1. Opening title card (with the user's chosen opening words)
//   2. Closing title card (with the user's chosen closing words)
//   3. One representative in-scene caption frame (the first beat's
//      scene + caption, so the user can read the typography "in their world")
//
// Critical invariants enforced by these builders (spec line 208-221 +
// task brief):
//   - Typography pairing comes from `art-styles.ts::typography_directive`
//     for the user's chosen style — NEVER hardcoded here.
//   - Likeness reference sentence is the SAME locked string used by every
//     other Stage 5+ render. Opening/closing cards still pass the character
//     sheet as a reference so the pet appears (faintly) in the title-card
//     world; the in-scene caption render obviously needs the likeness.
//   - Opening + closing cards explicitly say "no motion — this is a still
//     title card." Stage 6 (video) does not touch these frames at all
//     (spec line 1069: "those remain still stills, composited at 7").
//   - Captions/title text are rendered as in-frame container objects per
//     the typography directive — NOT as UI overlays. The typography
//     directive itself carries the "not a UI bar" phrasing per spec.
//   - No humans, no illness, no death (same exclusions as every other
//     Stage 5+ prompt).
//
// Pure functions: no I/O, no Date.now. Same input → same output.

import type { ArtStyle } from '@/lib/library/art-styles';
import type { BeatWire, SessionWire } from '@/lib/builder/wire-types';
import type { Format } from '@/lib/library/formats';
import type { Theme } from '@/lib/library/themes';

import {
  type NormalizedAspect,
  normalizeAspect,
} from './build-preview';

/**
 * Locked likeness-reference sentence, identical to the storyboard-frame and
 * combination-preview builders. The sole reference passed is the character
 * sheet (singular), so the wording stays "from the reference photo."
 */
export const LIKENESS_REFERENCE_SENTENCE_TEMPLATE =
  'Replicate the exact likeness, markings, proportions, and distinguishing features of [PET_NAME] from the reference photo. Do not invent any other animal.';

/**
 * Hard exclusions appended to every card-preview prompt. Matches every other
 * Stage 5+ builder so the safety contract is identical across the pipeline.
 *
 * Note: the standard "no text, no labels, no watermarks" line from the other
 * builders is INTENTIONALLY OMITTED here — these prompts deliberately bake
 * text into the frame via the typography container. Watermarks are still
 * disallowed (called out explicitly below).
 */
export const HARD_EXCLUSIONS = [
  'No humans in frame.',
  'No medical equipment, no illness, no injury, no death, no distressing imagery — only living, peaceful, and dignified depictions.',
  'No watermarks. No page numerals. No date stamps.',
];

export type CardKind = 'opening' | 'closing' | 'in_scene_caption';

export type BuildCardPreviewBaseInput = {
  /** Session wire (snake_case). Reads `pet_name`, `aspect_ratio`. */
  session: Pick<SessionWire, 'pet_name' | 'aspect_ratio'>;
  /** Chosen format — provides visual_archetype context for the title cards. */
  format: Format;
  /** Chosen theme — provides the title-card backdrop description. */
  theme: Theme;
  /**
   * Chosen art style. Provides both the visual register (`directive`) AND
   * the locked typography container spec (`typography_directive`).
   */
  style: ArtStyle;
  /** Public URL of the locked character-sheet asset. The sole reference image. */
  charSheetUrl: string;
};

export type BuildCardPreviewOutput = {
  prompt: string;
  references: Array<{ url: string; role: 'subject' }>;
};

/**
 * Build the Stage 5.6 OPENING title-card prompt.
 *
 * Renders a still title card (no motion language) showing the opening words
 * baked into the locked typography container for the chosen art style. The
 * container occupies ~60% of frame area, centered vertically — there is no
 * in-scene action to defer to (spec line 1049).
 */
export function buildOpeningCard(
  input: BuildCardPreviewBaseInput & { openingText: string },
): BuildCardPreviewOutput {
  return buildTitleCard({ ...input, kind: 'opening', text: input.openingText });
}

/**
 * Build the Stage 5.6 CLOSING title-card prompt.
 *
 * Same structure as the opening card — still title card, ~60% container,
 * centered vertically, no motion language. The closing words live inside
 * the container.
 */
export function buildClosingCard(
  input: BuildCardPreviewBaseInput & { closingText: string },
): BuildCardPreviewOutput {
  return buildTitleCard({ ...input, kind: 'closing', text: input.closingText });
}

/**
 * Build the Stage 5.6 IN-SCENE CAPTION preview prompt.
 *
 * Renders the FIRST beat's scene with the first beat's caption embedded as
 * an in-frame typography object — per spec, the caption container is
 * an illustrated decorative object spanning ~80% of frame width in the
 * lower portion of the frame. This is the user's first chance to see the
 * caption typography "in their world" before any video render fires.
 */
export function buildInSceneCaption(
  input: BuildCardPreviewBaseInput & { beat: BeatWire },
): BuildCardPreviewOutput {
  const petName = (input.session.pet_name ?? '').trim() || 'this pet';
  const aspect = normalizeAspect(input.session.aspect_ratio);

  const likenessSentence = LIKENESS_REFERENCE_SENTENCE_TEMPLATE.replace(
    /\[PET_NAME\]/g,
    petName,
  );

  const beatBlock = [
    `Scene context (storyboard beat #${input.beat.idx + 1}, ${input.beat.archetype}):`,
    input.beat.scene_description,
  ].join('\n');

  const themeBlock = `Theme — ${input.theme.label}: ${input.theme.scene_description}`;
  const formatBlock = `Format context — ${input.format.label}: ${input.format.visual_archetype}`;

  const styleBlock = `Art style: ${input.style.directive}`;

  // Locked typography directive from the art-styles library — the
  // container spec is the source of truth for in-scene caption rendering.
  const typographyBlock = [
    'Caption text rendered as an in-frame illustrated object using the locked typography pairing for this art style — NOT a UI overlay. The text is baked into the scene as the container described below.',
    `Typography pairing — ${input.style.label}: ${input.style.typography_directive}`,
    `Caption text inside the container, spelled exactly as written below — verify every letter:`,
    `"${input.beat.caption}"`,
    'Identical container specification on every scene in the storybook.',
  ].join('\n');

  const framingBlock = [
    aspectFramingDirective(aspect),
    'Soft, warm, gentle lighting. The caption container sits clearly readable above the lower scene action.',
  ].join(' ');

  const exclusions = HARD_EXCLUSIONS.join(' ');

  const sections: string[] = [
    likenessSentence,
    '',
    beatBlock,
    '',
    themeBlock,
    '',
    formatBlock,
    '',
    styleBlock,
    '',
    typographyBlock,
    '',
    framingBlock,
    '',
    exclusions,
  ];

  const prompt = sections.join('\n').trim();

  return {
    prompt,
    references: [{ url: input.charSheetUrl, role: 'subject' }],
  };
}

// ----------------------------------------------------------------------------
// Internal — shared title-card assembly.
//
// Opening + closing share the same structural template: a clean theme-
// appropriate backdrop with the typography container enlarged to roughly
// 60% of the frame area and centered vertically (spec line 1049).
// ----------------------------------------------------------------------------

type TitleCardInput = BuildCardPreviewBaseInput & {
  kind: 'opening' | 'closing';
  text: string;
};

function buildTitleCard(input: TitleCardInput): BuildCardPreviewOutput {
  const petName = (input.session.pet_name ?? '').trim() || 'this pet';
  const aspect = normalizeAspect(input.session.aspect_ratio);

  const likenessSentence = LIKENESS_REFERENCE_SENTENCE_TEMPLATE.replace(
    /\[PET_NAME\]/g,
    petName,
  );

  const role = input.kind === 'opening' ? 'opening title card' : 'closing card';

  // No-motion declaration is load-bearing here — Stage 6 (video) does not
  // touch these frames, so we must explicitly anchor them as stills so the
  // image model doesn't try to render a "motion-implying" composition.
  const cardIntent = [
    `This is the ${role} for a pet tribute. NO MOTION — this is a still title card composed entirely for legibility of the in-frame text.`,
    `Subject: a clean, theme-appropriate backdrop for the title-card text. ${petName} may appear softly in the background of the card composition, calm and centered, but the text container is the primary focal element.`,
  ].join('\n');

  const themeBlock = [
    `Theme backdrop — ${input.theme.label}: ${input.theme.scene_description}`,
    'Render the backdrop as a clean title-card stage: even composition, gentle negative space behind the text, no busy environmental action.',
  ].join('\n');

  const formatBlock = `Format context — ${input.format.label}: ${input.format.visual_archetype}`;

  const styleBlock = `Art style: ${input.style.directive}`;

  // Locked typography directive enlarged for a title card per spec line 1049.
  const typographyBlock = [
    `Title-card text rendered as an in-frame illustrated object using the locked typography pairing for this art style — NOT a UI overlay. The text is baked into the scene as the container described below, enlarged to roughly 60% of the frame area and centered vertically (this is a title card with no in-scene action to defer to).`,
    `Typography pairing — ${input.style.label}: ${input.style.typography_directive}`,
    `Title text inside the container, spelled exactly as written below — verify every letter and preserve line breaks:`,
    `"""`,
    input.text,
    `"""`,
    'Identical container specification on every scene in the storybook.',
  ].join('\n');

  const framingBlock = [
    aspectFramingDirective(aspect),
    'Soft, warm, gentle lighting on the title-card composition.',
  ].join(' ');

  const exclusions = HARD_EXCLUSIONS.join(' ');

  const sections: string[] = [
    likenessSentence,
    '',
    cardIntent,
    '',
    themeBlock,
    '',
    formatBlock,
    '',
    styleBlock,
    '',
    typographyBlock,
    '',
    framingBlock,
    '',
    exclusions,
  ];

  const prompt = sections.join('\n').trim();

  return {
    prompt,
    references: [{ url: input.charSheetUrl, role: 'subject' }],
  };
}

function aspectFramingDirective(aspect: NormalizedAspect): string {
  switch (aspect) {
    case '9:16':
      return 'Vertical 9:16 framing.';
    case '16:9':
      return 'Horizontal 16:9 framing.';
    case '1:1':
      return 'Square 1:1 framing.';
  }
}
