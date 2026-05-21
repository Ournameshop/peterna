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

// -----------------------------------------------------------------------------
// Stage 2 — Character Sheet copy.
//
// Tone rules (HARD, from copy-and-content.md):
//   - No cost language. Re-rolls are framed as "let's get it right," not as
//     expensive or limited.
//   - "Looks like" / "I see" — the UI never asserts "this is your pet."
//   - Loading copy uses the pet's name: "Drawing [PET_NAME]…" never "Generating image…"
// -----------------------------------------------------------------------------

/**
 * Stage 2.0 hand-off panel — sits between intake_complete and the first render.
 * The user taps "Start the character sheet" to fire the render. This screen
 * is where the wizard explicitly sets the user's expectation for the
 * first GATE moment.
 */
export const STAGE_2_INTRO = {
  headline: "Now let's bring [PET_NAME] to life on the page.",
  body: "We'll draw a four-view character sheet of [PET_NAME] using the photos you shared. We'll review it together, and you can ask for changes as many times as it takes — there's no rush.",
  start_button: 'Start the character sheet',
} as const;

/**
 * Stage 2.1 — render loading state.
 *
 * Pet name is REQUIRED in the loading line per spec ("Drawing [PET_NAME]…").
 * Never "Generating image…" or vendor names.
 */
export const CHARACTER_SHEET_LOADING = {
  drawing: 'Drawing [PET_NAME]…',
  drawing_hint:
    'Sketching four views — front, three-quarter, side, and full body. This takes a moment.',
} as const;

/**
 * Stage 2.2 — character sheet review (GATE 1).
 *
 * Pills are framed in collaborative language: "let's get it right" — never
 * "are you sure" / "this will use credits" / cost-pressure.
 */
export const CHARACTER_SHEET_REVIEW = {
  headline: "Here's [PET_NAME].",
  subhead: 'Take a look at all four views. Tell us what to keep and what to adjust.',
  pills: {
    approve: 'Looks great',
    refine: 'Needs tweaks',
    restart: 'Start over',
  },
  // Subtle helper rendered next to the pill row so the gate doesn't read as
  // a binary "approve / reject" — it reads as a conversation.
  pills_hint:
    "There's no wrong answer here. We can keep tuning until it feels right.",
} as const;

/**
 * Stage 2.3 — refinement panel (sub-state of the review screen).
 *
 * The chip labels themselves live in `src/lib/builder/refinements.ts` (each
 * chip carries its own user-facing label). This block holds the framing
 * copy around the chip group.
 */
export const CHARACTER_SHEET_REFINEMENT = {
  headline: 'What should we adjust?',
  subhead:
    'Tap anything that needs a tweak — pick as many as you want. Add a note below if you want to describe something specific.',
  notes_label: 'Anything else?',
  notes_placeholder:
    "e.g. The fur on her chest should be more white, and her tail is longer than this.",
  // Action labels
  submit: "Redraw [PET_NAME] with these notes",
  cancel: "Never mind — go back",
} as const;

/**
 * Stage 2.4 lock — small confirmation when the user approves.
 * Not user-visible mid-flight; rendered as a brief inline status.
 */
export const CHARACTER_SHEET_APPROVED = {
  status: "Locked in. We'll use this likeness everywhere from here on.",
} as const;

/**
 * Stage 2.5 — Length picker.
 *
 * Labels are emotionally framed first; minutes/beats are secondary
 * clarification per spec §2.5.
 */
export const LENGTH_FRAMING = {
  question: "How long should [PET_NAME]'s tribute be?",
  hint: 'You can change this later if you want to.',
  pills: {
    short: {
      label: 'A short keepsake',
      description: '2 minutes · 8 beats',
    },
    full: {
      label: 'A full tribute',
      description:
        '3 minutes · 12 beats · sweet spot for emotional pacing without overstaying',
      badge: 'Recommended',
    },
    extended: {
      label: 'An extended remembrance',
      description: '4 minutes · 16 beats',
    },
  },
} as const;

/**
 * Stage 2.6 — Aspect picker.
 */
export const ASPECT_FRAMING = {
  question: "Where will [PET_NAME]'s tribute live?",
  hint: '',
  pills: {
    phone: {
      label: 'On my phone',
      description: 'Vertical 9:16 · easiest to share and watch',
      badge: 'Recommended',
    },
    tv: {
      label: 'On a TV or computer',
      description:
        'Horizontal 16:9 · best for family viewing, YouTube, projecting at a memorial',
    },
    social: {
      label: 'Social feeds',
      description: 'Square 1:1 · best for Instagram, Facebook',
    },
  },
} as const;

// -----------------------------------------------------------------------------
// Stage 3 — Format / Theme / Style copy.
//
// Tone rules carry over from Stage 2: no cost language, no apology. Re-rolls
// are framed as "let's get the look right." The art-style / theme labels come
// from the library content; this block holds the framing copy around them.
// -----------------------------------------------------------------------------

/**
 * Stage 3.1 — Curator's Picks shortcut + manual path.
 */
export const CURATORS_PICK_FRAMING = {
  question: "Want a recommended tribute style, or pick everything yourself?",
  hint: "Each pick locks the format, the world, and the art style. You'll still be able to swap the style on the next screen.",
  /** Appended as a small secondary line under the position-#1 pick that the
   *  relationship reorder bubbled to the top. */
  relationship_subtitle: "Based on what [PET_NAME] was to you",
  manual_pill_label: "Help me choose myself",
  manual_pill_description:
    "We'll walk through the format, the world, and the style one at a time.",
} as const;

/**
 * Stage 3.1.5 — Style confirmation after Curator's Pick (v2.3).
 *
 * The literal `[STYLE_NAME]` placeholder is substituted at render-time with
 * the chosen pick's style label.
 */
export const CURATOR_STYLE_CONFIRM = {
  question:
    "This pick uses [STYLE_NAME] — keep it, or switch the visual style? (Format and world stay the same.)",
  hint: "The art style drives more of how the tribute feels than format or theme. Worth a moment to be sure.",
  /** Pill label for the locked-in style — substituted with the style label. */
  keep_label_template: "Keep [STYLE_NAME]",
  keep_secondary: "what your pick uses",
  opt_in_secondary: "Explicit opt-in — for celebratory or family-with-kids tributes.",
} as const;

/**
 * Stage 3.2 — Format picker (manual path).
 */
export const FORMAT_FRAMING = {
  question: "What kind of tribute?",
  hint: "Each one shapes the pacing and how the story unfolds. You can change your mind later.",
} as const;

/**
 * Stage 3.3a — Theme category picker.
 */
export const THEME_CATEGORY_FRAMING = {
  question: "What world should the tribute live in?",
  hint: "Pick the feeling first — we'll narrow to the two themes inside it.",
} as const;

/**
 * Stage 3.3b — Theme picker (filtered to the chosen category).
 */
export const THEME_FRAMING = {
  question: "Pick the world for [PET_NAME]'s tribute.",
  hint: "Two themes inside this category. You can go back and pick a different category if neither feels right.",
  back_label: "Back to categories",
} as const;

/**
 * Stage 3.4 — Art style picker (manual path).
 */
export const STYLE_FRAMING = {
  question: "How should we paint [PET_NAME]'s tribute?",
  /** Section label above the first 6 pills. */
  group_warm_label: "Warm and traditional",
  /** Section label above the last 2 pills. */
  group_playful_label: "Playful and stylized",
  group_playful_hint:
    "Best for celebratory tributes — explicit opt-in only.",
} as const;

/**
 * Stage 3.5 — Combination preview review (GATE 2).
 */
export const COMBINATION_PREVIEW = {
  headline: "Here's [PET_NAME] in this world.",
  /** Substituted at runtime with format / theme / style labels. */
  subhead_template:
    "[FORMAT_NAME] + [THEME_NAME] + [STYLE_NAME]. Does this feel right?",
  loading: "Painting the first look at [PET_NAME]…",
  loading_hint:
    "One frame to show you how the chosen format, world, and style feel together. This takes a moment.",
  pills: {
    approve: "Looks beautiful",
    restart_style: "Try a different style",
    restart_theme: "Try a different theme",
    restart_all: "Start over",
  },
  pills_hint:
    "There's no wrong answer here. We can keep tuning until it feels right.",
} as const;

/**
 * Stage 3-complete handoff.
 */
export const STAGE_3_COMPLETE = {
  headline: "Locked in. We'll carry this look into every beat.",
  body: "Next, we'll sketch the story — a beat-by-beat outline of [PET_NAME]'s tribute. You'll get to review and edit every beat before any of them become real frames.",
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
  STAGE_2_INTRO,
  CHARACTER_SHEET_LOADING,
  CHARACTER_SHEET_REVIEW,
  CHARACTER_SHEET_REFINEMENT,
  CHARACTER_SHEET_APPROVED,
  LENGTH_FRAMING,
  ASPECT_FRAMING,
  CURATORS_PICK_FRAMING,
  CURATOR_STYLE_CONFIRM,
  FORMAT_FRAMING,
  THEME_CATEGORY_FRAMING,
  THEME_FRAMING,
  STYLE_FRAMING,
  COMBINATION_PREVIEW,
  STAGE_3_COMPLETE,
} as const;
