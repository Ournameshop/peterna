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
  beat_sheet: {
    emoji: '📝',
    headline: 'Stage 4: Beat sheet — drafting the story of the tribute',
  },
  storyboard: {
    emoji: '🖼️',
    headline: 'Stage 5: Storyboard — one frame for every beat',
  },
  words: {
    emoji: '✍️',
    headline:
      "Stage 5.5: The Words — how [PET_NAME]'s tribute opens, closes, sounds",
  },
  card_preview: {
    emoji: '🎴',
    headline:
      "Stage 5.6: Card preview — the opening, the closing, and a caption in [PET_NAME]'s world",
  },
  cinematography: {
    emoji: '🎬',
    headline:
      "Stage 5.7: Cinematography — how each scene will move",
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
  /** CTA on the stage_3_complete screen that fires the Stage 4 generate. */
  start_button: 'Draft the beat sheet',
} as const;

// -----------------------------------------------------------------------------
// Stage 4 — Beat Sheet copy.
//
// Tone rules carry over: no cost language, no apology, no vendor names. Beat
// regeneration is framed as "let's draft a different story," never as "this
// will use credits." The caption length warning is soft: warn, don't block.
// -----------------------------------------------------------------------------

/**
 * Stage 4.1 — loading state while the beat sheet generates.
 *
 * Pet name is REQUIRED in the loading line per spec.
 */
export const BEAT_SHEET_LOADING = {
  drafting: 'Drafting the story of [PET_NAME]…',
  drafting_hint:
    "Outlining the beats, one moment at a time — what we'll open with, the memories that carry it, and how it closes.",
} as const;

/**
 * Stage 4.2 — beat sheet review (the editable list + approval pills).
 *
 * Per spec rule, "Beat N of M" is the only place we use numerals on
 * scene-card labels. Author-facing labels in the review UI are fine; the
 * page-numeral prohibition is about the rendered tribute itself.
 */
export const BEAT_SHEET_REVIEW = {
  headline: "Here's the story for [PET_NAME].",
  subhead:
    "Each beat is a moment in the tribute. Edit the caption or the scene description if anything doesn't feel right.",
  /** Substituted with the beat index (1-based) and total. */
  beat_label_template: 'Beat [N] of [M]',
  /** Field labels inside each beat card. */
  caption_label: 'Caption',
  caption_helper: 'Under 15 words — this appears in the frame.',
  scene_label: 'Scene description',
  scene_helper:
    "What the frame shows. The model uses this to draw the storyboard.",
  /** Edit / done toggle on each beat card. */
  edit_button: 'Edit',
  done_button: 'Done',
  /** Pill row (passed to <GateReview>). */
  pills: {
    approve: 'Approve and continue',
    regenerate: 'Rewrite the whole sheet',
    restart: 'Start over',
  },
  pills_hint:
    "Edit any beat above, or rewrite the whole sheet if the story isn't landing.",
} as const;

/**
 * Soft-validation warning when a caption exceeds 15 words.
 * Warn, don't block — the user may have a strong reason.
 */
export const BEAT_SHEET_CAPTION_WARNING = {
  /** Substituted: [N] = current word count. */
  over_limit:
    'This caption runs [N] words — captions read best under 15. You can keep it if you want.',
} as const;

/**
 * Stage 4 archetype display labels — small uppercase tag rendered on each beat
 * card. The wire archetype strings (`opening`, `peak`, `closing`, …) map to
 * these display labels; unknown archetypes fall back to the raw string.
 *
 * Per spec §"Beat structure by length," the archetypes used in 8/12/16-beat
 * sheets are: open(ing), memory, connection, ceremonial, release, close/closing.
 */
export const BEAT_ARCHETYPE_LABELS: Readonly<Record<string, string>> = {
  open: 'OPENING',
  opening: 'OPENING',
  memory: 'MEMORY',
  connection: 'CONNECTION',
  ceremonial: 'CEREMONIAL',
  release: 'RELEASE',
  close: 'CLOSING',
  closing: 'CLOSING',
  // Less common archetypes the model may emit on extended sheets.
  rising: 'RISING',
  turning: 'TURNING',
  peak: 'PEAK',
  descent: 'DESCENT',
};

/**
 * Stage 4-complete handoff — sits between beat_sheet_complete and Stage 5
 * (storyboard render). Tapping `start_button` fires `storyboard_render_started`.
 */
export const BEAT_SHEET_COMPLETE = {
  headline: "Story locked. Every beat is ready.",
  body: "Next, we'll draw one frame for each beat of [PET_NAME]'s tribute. You'll review the storyboard before any of it becomes real video.",
  start_button: 'Draw the storyboard',
} as const;

// -----------------------------------------------------------------------------
// Stage 5 — Storyboard copy.
//
// Tone rules carry over: no cost language, no apology, no vendor names. Per
// the v2.3 spec §5: reroll is "let's try this scene differently" — never
// "regenerate" / "re-render" / cost-pressure. The grid is emotional —
// captions truncate to one line by default and expand on tap.
// -----------------------------------------------------------------------------

/**
 * Stage 5.1 — render loading state.
 *
 * Pet name is REQUIRED in the loading line per spec ("Drawing the
 * storyboard for [PET_NAME]…"). Loading takes about a minute since N
 * frames render in parallel.
 */
export const STORYBOARD_LOADING = {
  drawing: 'Drawing the storyboard for [PET_NAME]…',
  drawing_hint:
    "One frame per beat — this takes about a minute. We're painting them all together.",
} as const;

/**
 * Stage 5.2 — storyboard review (GATE 2).
 *
 * Pills are framed in collaborative language. No "regenerate this frame" —
 * we say "let's try this scene differently" via the per-frame review.
 */
export const STORYBOARD_REVIEW = {
  headline: "Here's the storyboard for [PET_NAME].",
  subhead:
    'One frame for each beat. Tap any frame to try it differently, or approve the full sequence when it feels right.',
  /** Pill row at the bottom of the grid (gate-level). */
  pills: {
    approve: 'Approve the storyboard',
    restart: 'Start over',
  },
  pills_hint:
    "Each frame can be tried again on its own — tap one to take a closer look.",
} as const;

/**
 * Stage 5.2a — per-frame card copy.
 *
 * Author-facing scene labels are allowed ("Scene N of M"). Captions are
 * truncated to one line by default; tapping "See details" expands them.
 */
export const STORYBOARD_FRAME = {
  /** Substituted with the beat index (1-based) and total. */
  scene_label_template: 'Scene [N] of [M]',
  /** Aria label for each frame card. Substituted with N and M. */
  card_aria_template: 'Storyboard frame [N] of [M]',
  /** Inline truncation indicator on collapsed captions. */
  caption_expand: 'See details',
  caption_collapse: 'Hide details',
  /** Tap-to-open mini-gate pills. */
  pills: {
    keep: 'Looks good',
    reroll: 'Try this scene differently',
    details: 'See details',
  },
  /** Mini-gate refinement panel framing. */
  refine_headline: 'What should we change about this scene?',
  refine_subhead:
    'Pick any details that need adjusting, or describe what to try instead. We can keep tuning this frame on its own.',
  refine_notes_label: 'Anything specific?',
  refine_notes_placeholder:
    "e.g. Try a wider shot, with the sun coming in from the left.",
  refine_submit: 'Try this scene again',
  refine_cancel: "Never mind — keep this one",
} as const;

/**
 * Stage 5.2b — per-frame reroll loading panel.
 *
 * Shown when a single frame is being re-rendered. Other frames in the grid
 * stay visible — only the rerolling card shifts to its own loading state.
 */
export const STORYBOARD_REROLL_LOADING = {
  /** Substituted with the 1-based scene number. */
  drawing: 'Trying scene [N] again…',
  drawing_hint: "This takes a moment. We'll bring you right back to the grid.",
} as const;

/**
 * Stage 5-complete handoff — soft pause between storyboard_complete and the
 * Stage 5.5 entry (Phase 5). The Stage 5.5 CTA itself is a Phase 5 concern.
 */
export const STORYBOARD_COMPLETE = {
  headline: 'Storyboard locked. Every frame is ready.',
  body: "Next, we'll write the words that carry the tribute — the opening line, the captions, and how it closes.",
  start_button: 'Write the words',
} as const;

// -----------------------------------------------------------------------------
// Stage 5.5 — The Words.
//
// Tone: this is where the tribute "stops being a template and becomes theirs"
// (SKILL spec §5.5). Section labels are gentle, generous defaults are
// pre-filled, every section is optional. Music + narration default to OFF —
// the user opts in.
// -----------------------------------------------------------------------------

export const WORDS_EDITOR = {
  headline: "The words for [PET_NAME]'s tribute.",
  subhead:
    "Open the tribute, close the tribute, pick a piece of music, add a spoken letter — or skip any of it. We've filled in defaults that work beautifully if you'd rather just continue.",
  sections: {
    opening: {
      label: 'Opening title card',
      hint: "The first words on screen. We've filled in their name — change it or keep it.",
      placeholder: 'e.g. [PET_NAME] — a life well loved',
    },
    closing: {
      label: 'Closing card',
      hint: "How the tribute ends. Default is 'With love, always' — change it or keep it.",
      placeholder: 'e.g. With love, always',
    },
    music: {
      label: 'Music',
      hint: 'A gentle piece of music plays across the tribute. Skip for ambient sound only.',
      skip_pill_label: 'No music — ambient sound',
    },
    narration: {
      label: 'Narration (optional)',
      hint: "A spoken voice reads a short letter to [PET_NAME] across the tribute. Skip if you'd rather let the images speak.",
      voice_question: 'Pick a voice',
      text_label: 'What should they say?',
      text_placeholder:
        "e.g. My sweet boy. You filled every day with joy. We loved you, and we always will.",
      skip_pill_label: 'No narration — silent',
    },
  },
  continue: 'Continue to card preview',
  continue_hint:
    "We'll render three sample cards in [PET_NAME]'s world so you can see how the words look before any video is made.",
} as const;

/**
 * Stage 5.5-complete handoff — soft pause between words_complete and the
 * card-preview render. Most users won't see this screen; it exists so
 * deep-link users can resume mid-flow without losing context.
 */
export const WORDS_COMPLETE = {
  headline: 'Words locked in.',
  body: "Next, we'll render three sample cards — the opening, the closing, and one in-scene caption — so you can see how the words sit in [PET_NAME]'s world before any video is made.",
  start_button: 'See the cards',
} as const;

// -----------------------------------------------------------------------------
// Stage 5.6 — Card preview (v2.3 addition).
//
// Three GPT Image 2 stills (opening, closing, in-scene caption) rendered in
// the locked typography pairing for the chosen art style, so the user can
// catch awkward line breaks / clashing containers / wrong-style-for-the-words
// at still-frame cost before any video render fires.
// -----------------------------------------------------------------------------

export const CARD_PREVIEW = {
  loading:
    "Rendering [PET_NAME]'s opening, closing, and a caption frame…",
  loading_hint:
    "Three still cards in the chosen typography. This takes about a minute. We're painting them all together.",
  headline: 'How do the cards look?',
  subhead:
    "Opening, closing, and one in-scene caption — rendered in [PET_NAME]'s world so you can see how the words sit before any video.",
  labels: {
    opening: 'Opening title card',
    closing: 'Closing card',
    in_scene_caption: 'In-scene caption sample',
  },
  pills: {
    approve: 'Looks beautiful',
    restart_words: 'Edit the words',
    rerender: 'Try different music',
    restart: 'Start over',
  },
  pills_hint:
    "There's no wrong answer here — we can keep tuning until the type, the music, and the words feel right.",
} as const;

// -----------------------------------------------------------------------------
// Stage 5.7 — Cinematography Engine (v2.0).
//
// Two screens:
//   - cinematography_brief: the DP overlay picker. The user picks one of 5
//     real-cinematographer styles (or "no specific style"), then taps
//     "Apply this look" which runs the derive call (vision-pass per frame
//     + per-beat brief derivation + consistency pass + DP bias).
//   - cinematography_review: the per-beat brief table. The user can edit
//     individual fields inline, or tap "Looks great" / "Reapply derivation" /
//     "Start over."
//
// Loading copy uses the pet's name per spec rule "Loading copy uses the pet's
// name."
// -----------------------------------------------------------------------------

export const CINEMATOGRAPHY = {
  picker: {
    headline: 'How should [PET_NAME]’s tribute move?',
    subhead:
      "Pick a cinematographer’s look, or let the engine decide. Either way, we'll show you the per-scene plan before any video renders.",
    pick_hint:
      "Bias only — we still apply the tribute’s motion rules. You'll see every choice and can override anything.",
    submit: 'Apply this look',
  },
  loading:
    "Composing the cinematography for [PET_NAME]…",
  loading_hint:
    "Reading every storyboard frame, choosing the lens, camera move, lighting, and audio for each scene. About a minute.",
  review: {
    headline: 'How [PET_NAME]’s tribute will move.',
    subhead:
      'One row per beat. Tap any cell to override a choice — or just tap “Looks great” and we’ll start the renders.',
    pills: {
      approve: 'Looks great',
      regenerate: 'Reapply derivation',
      restart: 'Start over',
    },
    pills_hint:
      "Overrides stay in place when you reapply. Start over clears all of them and resets the DP look.",
  },
  /** Header labels for the brief table — column order is left-to-right
   *  reading like a shot list. */
  columns: {
    beat: 'Beat',
    archetype: 'Type',
    lens: 'Lens',
    camera_move: 'Camera',
    motion: 'Motion',
    lighting: 'Lighting',
    dof: 'DoF',
    shot: 'Shot',
    audio: 'Audio',
  },
  /** Short, user-facing chip labels for every legal field value. Engine wire
   *  values are snake_case enums; these map them to scannable display strings. */
  field_labels: {
    lens_mm: {
      24: '24mm',
      35: '35mm',
      50: '50mm',
      85: '85mm',
      105: '105mm',
    },
    camera_move: {
      locked_off: 'Locked off',
      slow_push: 'Slow push',
      slow_pull: 'Slow pull',
      slow_rise: 'Slow rise',
      slow_fall: 'Slow fall',
      slow_pan_L: 'Slow pan L',
      slow_pan_R: 'Slow pan R',
      slow_orbit: 'Slow orbit',
      parallax_dolly: 'Parallax dolly',
      handheld_float: 'Handheld float',
      dreamy_drift: 'Dreamy drift',
    },
    move_intensity: {
      barely_perceptible: 'Barely there',
      gentle: 'Gentle',
      pronounced: 'Pronounced',
    },
    subject_motion: {
      locked: 'Locked',
      breath_only: 'Breath only',
      loop_idle: 'Loop idle',
      loop_action: 'Loop action',
      one_shot_action: 'One-shot',
    },
    lighting_motion: {
      static: 'Static',
      drifting_sunbeam: 'Drifting sun',
      leaf_dapple_breeze: 'Leaf dapple',
      candle_flicker: 'Candle',
      dust_motes: 'Dust motes',
      rim_light_pulse: 'Rim pulse',
    },
    dof_behavior: {
      locked_shallow: 'Locked shallow',
      locked_deep: 'Locked deep',
      rack_to_subject: 'Rack to subject',
      rack_to_environment: 'Rack to env',
      rack_to_caption: 'Rack to caption',
    },
    shot_structure: {
      single_sustained: 'Single sustained',
      two_shot_cut: 'Two-shot cut',
      three_shot_montage: 'Three-shot',
    },
    ambient_audio: {
      birdsong: 'Birdsong',
      wind_grass: 'Wind & grass',
      hearth_crackle: 'Hearth',
      soft_rain: 'Soft rain',
      water_lapping: 'Water',
      silence: 'Silence',
      breath_only: 'Breath only',
    },
    audio_intensity: {
      bed_only: 'Bed only',
      present: 'Present',
      forward: 'Forward',
    },
  },
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
  BEAT_SHEET_LOADING,
  BEAT_SHEET_REVIEW,
  BEAT_SHEET_CAPTION_WARNING,
  BEAT_ARCHETYPE_LABELS,
  BEAT_SHEET_COMPLETE,
  STORYBOARD_LOADING,
  STORYBOARD_REVIEW,
  STORYBOARD_FRAME,
  STORYBOARD_REROLL_LOADING,
  STORYBOARD_COMPLETE,
  WORDS_EDITOR,
  WORDS_COMPLETE,
  CARD_PREVIEW,
  CINEMATOGRAPHY,
} as const;
