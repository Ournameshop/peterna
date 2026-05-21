// Locked verbatim user-facing strings — Stages 1.0 through 1.12.
// Source: docs/tribute-builder/copy-and-content.md + SKILL v2.3 §1.0–§1.12.
//
// DO NOT paraphrase, condense, or restyle anything in WELCOME_LINES,
// CONFIRMATION_FRAMING, or STAGE_BANNERS. The visual treatment is up
// to the component layer; the words are locked by PM / Xee.

/**
 * Stage 1.0 anti-trauma welcome copy.
 *
 * The `[pet]` placeholder is substituted with the pet's name once captured
 * (Stage 1.3 onward); on first render, fall back to the literal string
 * `'your pet'` per the spec.
 *
 * Locked verbatim. No "Continue" button is shown — the user advances by
 * starting the next form (`intake_photos`) below the panel.
 */
export const WELCOME_LINES = [
  "I'm so glad you're here for [pet]. Let's make something beautiful together.",
  "Before we begin — I won't ask you about their last day, or how they passed. If you ever want to share that, you can, but I'll never push for it.",
  "We'll go slowly, one question at a time. Every step is skippable. You can redo anything as many times as you need — there's no rush, and nothing here is permanent until you say it is.",
  'Ready when you are.',
] as const;

/**
 * Single source for substituting `[pet]` / `[PET_NAME]` placeholders.
 * Falls back to `your pet` when name is not yet captured.
 */
export function substitutePetName(template: string, petName: string | null | undefined): string {
  const name = petName && petName.trim().length > 0 ? petName.trim() : 'your pet';
  return template.replace(/\[pet\]/g, name).replace(/\[PET_NAME\]/g, name);
}

/**
 * Stage banners — emoji + headline per stage entry.
 * Locked per the "Stage banners" table in copy-and-content.md.
 */
export const STAGE_BANNERS = {
  intake: {
    emoji: '🌿',
    headline:
      'Stage 1: Tell me about [PET_NAME] — photos, name, what we see, the essentials',
  },
  character_sheet: {
    emoji: '🐾',
    headline: "Stage 2: Character sheet — locking [PET_NAME]'s likeness",
  },
  format_theme_style: {
    emoji: '🎬',
    headline:
      "Stage 3: Choosing the kind of tribute, the world it lives in, and how it's painted",
  },
} as const;

/**
 * Stage 1.1 returning-user check.
 */
export const RETURNING_USER = {
  question: 'Have you made a tribute with Peternal before?',
  buttons: {
    first_time: 'No, this is my first',
    returning: "Yes, I've done this before",
  },
} as const;

/**
 * Stage 1.2 photo prompts.
 */
export const PHOTO_PROMPT = {
  header_first: "Your pet's details",
  header_followup: 'More of [PET_NAME]',
  question_first:
    'Add photos of [PET_NAME]. More angles help us capture their likeness more accurately — a face shot, side profile, full body, and any that show their personality.',
  question_first_no_name:
    'Add photos of your pet. More angles help us capture their likeness more accurately — a face shot, side profile, full body, and any that show their personality.',
  question_followup:
    "If you have any more of [PET_NAME] — even just one more from a different angle — they'll help me capture their likeness more accurately. If this is the only one, that's completely OK.",
  url_label: 'Or paste a Google Drive, Dropbox, or direct image link',
  url_placeholder: 'https://drive.google.com/...',
  continue_with_one: 'Continue with one photo',
  skip: 'Skip',
  submit: 'Continue',
} as const;

/**
 * Stage 1.3 name + pronunciation prompts.
 */
export const NAME_PROMPT = {
  question: "What was your pet's name?",
  placeholder: 'e.g. Spike',
  submit: 'Continue',
  pronunciation_question:
    "How is [PET_NAME] pronounced? Write it phonetically — e.g. 'KEE-koh' or 'rhymes with sky'. Skip if it's read just how it looks.",
  pronunciation_placeholder: 'e.g. KEE-koh',
  pronunciation_skip: "Skip — it's read how it looks",
} as const;

/**
 * Stage 1.5 confirmation card framing (LOCKED verbatim).
 */
export const CONFIRMATION_FRAMING = {
  intro: "Here's what I see in your photos of [PET_NAME]:",
  outro: "Does that sound right? Tap anything you'd like to change.",
  chip_labels: {
    species: 'Species',
    breed: 'Breed',
    coat: 'Coat',
    age: 'Age',
  },
  accept: "Yes, that's [PET_NAME]",
  fix: 'Let me fix something',
  // Cancel/save inside an inline chip editor
  chip_save: 'Save',
  chip_cancel: 'Cancel',
} as const;

/**
 * Vision-failure fallback (1.4 → degrade to v0.7 explicit-question flow).
 * Plain, gentle phrasing — no apology, no model names.
 */
export const VISION_FAILURE = {
  headline: "Let's go through a couple of quick details about [PET_NAME].",
  subhead:
    "I couldn't quite read the photos — totally fine. A few short questions will get us there.",
} as const;

/**
 * Stage 1.6 memory prompt framing.
 */
export const MEMORY_FRAMING = {
  question: 'Pick one to tell us about [PET_NAME]. (Or skip — we can still make something beautiful.)',
  skip: 'Skip this for now',
  free_text_continue: 'Continue',
  free_text_skip: 'Skip',
} as const;

/**
 * Stage 1.7 gender prompt.
 */
export const GENDER_FRAMING = {
  question: 'How should we talk about [PET_NAME]?',
} as const;

/**
 * Stage 1.8 relationship prompt.
 */
export const RELATIONSHIP_FRAMING = {
  question: 'What was [PET_NAME] to you?',
  skip: "Other / I'd rather not say",
} as const;

/**
 * Stage 1.9 / 1.10 multi-select framings.
 */
export const TRAITS_FRAMING = {
  question: 'Which of these felt most like [PET_NAME]?',
  hint: 'Pick 2 or 3.',
  submit: 'Continue',
  skip: 'Skip',
} as const;

export const FAVORITES_FRAMING = {
  question: 'What did [PET_NAME] love?',
  hint: 'Pick 2 or 3.',
  submit: 'Continue',
  skip: 'Skip',
} as const;

/**
 * Stage 1.11 creator-name prompt.
 */
export const CREATOR_FRAMING = {
  question: "And what should we call you? (Optional — skip if you'd rather not say.)",
  placeholder: 'Your name',
  submit: 'Continue',
  skip: 'Skip',
} as const;

/**
 * Stage 1.12 years prompt.
 */
export const YEARS_FRAMING = {
  question: 'Would you like to include the years you had [PET_NAME]?',
  buttons: {
    yes: "Yes — I'll provide them",
    no_dates: "I'd rather not include dates",
    skip: 'Skip',
  },
  free_text_placeholder: 'e.g. 2015 – 2025',
  free_text_continue: 'Save dates',
} as const;

/**
 * Wizard shell / footer copy.
 * The "stuck-widget fallback" line from the spec becomes a single quiet
 * footer line here — not repeated per widget. Phrased for web.
 */
export const SHELL_COPY = {
  stuck_footer: 'Having trouble? Refresh — your work is saved.',
} as const;

/**
 * One barrel export for components that want the full object.
 */
export const COPY = {
  WELCOME_LINES,
  STAGE_BANNERS,
  RETURNING_USER,
  PHOTO_PROMPT,
  NAME_PROMPT,
  CONFIRMATION_FRAMING,
  VISION_FAILURE,
  MEMORY_FRAMING,
  GENDER_FRAMING,
  RELATIONSHIP_FRAMING,
  TRAITS_FRAMING,
  FAVORITES_FRAMING,
  CREATOR_FRAMING,
  YEARS_FRAMING,
  SHELL_COPY,
} as const;
