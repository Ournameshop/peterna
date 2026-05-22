# Builder UI/UX audit — 2026-05-22

Scope: every active builder screen in `src/components/builder/`, mounted through
`BuilderClient.tsx` and `WizardShell.tsx`. The screenshot Xee shared
(`?step=intake_welcome`) was a representative symptom; this audit walks every
stage and proposes fixes that respect the token system, the motion system, and
the locked anti-trauma copy.

## Overall assessment

The wizard's structural bones are good. The state machine, motion tokens, and
haptic system are thoughtful, the locked copy is doing real emotional work, and
the GateReview / PillPicker / TextField primitives compose cleanly across 35
component files. What's flat is the *transit* between those moments. The
welcome panel doesn't read as a panel (it's cream-on-cream with a divider
underneath that looks like a content break, not the start of a flow). Almost
every CTA is `C.ink` on `C.cream` — high contrast, but visually identical
across approve / submit / continue, so the user's eye has no hierarchy from
screen to screen. The footer ("Having trouble? Refresh — your work is saved.")
is the lowest-contrast element on every page and reads as the loudest only
because it's the only piece of "system voice" copy that doesn't have a peer.
There is no progress indicator anywhere in 20+ stages, which means a grieving
user has no spatial sense of where they are in a long journey — the StageBanner
gives a stage name, not a position. The motion tokens exist but are
under-deployed: only a handful of components actually use `fadeUp` /
`staggerChildren` / `revealPanel`; the rest mount instantly because the
WizardShell's stage transition is doing all the work. None of these are broken;
all of them combine to make the experience feel "tidy" when it should feel
"held."

## Cross-cutting issues

### CC-1. The Stage 1.0 welcome reads as a content header, not a held moment
`src/components/builder/WelcomePanel.tsx:20-29` paints the panel with
`background: C.cream` — identical to the page background `WizardShell.tsx:35`.
A 1px `C.line` border underneath is the only thing separating "the most
important 30 seconds in the product" from the form below it. Result: the
welcome doesn't feel like an envelope, it feels like a paragraph.

**Fix:** introduce a tinted surface token (e.g. `C.creamRaised = #FCF6E9` — a
~2L brighter cream) and apply it to the welcome panel as a soft floating
surface with a 32px radius and a *quiet* shadow (`0 1px 24px rgba(42,33,27,0.06)`).
The fix is not "make it bright"; it's "make the eye understand this is a
contained moment." See also the new `PageSurface` proposal below.

### CC-2. CTAs across the wizard are visually undifferentiated
The same `C.ink`-on-`C.cream` 999-radius pill is used for:
- "Continue" in TextField (`TextField.tsx:139-145`)
- "Continue" in PillPicker (`PillPicker.tsx:280-296`)
- "Continue" in PhotoUrlField (`PhotoUrlField.tsx:520-535`)
- "Yes, that's [PET_NAME]" approve in ConfirmationCard (`ConfirmationCard.tsx:336-354`)
- "Looks great" primary in GateReview (`GateReview.tsx:114-123`)
- "Copy" / "Save" / "Email me" buttons in DeliveryReadyView (`DeliveryReadyView.tsx:529-643`)

Six different *kinds* of action — submit a form, approve an artifact, copy a
link, send an email — all share one button skin. Approval should feel like
**affirmation** (gold-keyed, slightly weightier); progression should feel like
**continuation** (ink-on-cream, current behaviour); destructive/quiet should
feel like an aside (current `quiet` variant in GateReview is correct).

**Fix:** introduce three semantic button tokens and refactor the inline-button
sites to consume them:
- `progressBtn` — `C.ink` on `C.cream`, used for "Continue" form submits.
- `affirmBtn` — `C.gold` (or `C.goldDeep` on hover) on `C.ink` text, used for
  the *one* primary "approve / it's beautiful" action per gate.
- `quietBtn` — borderless underlined `C.inkSofter`, used for skip / start-over.

Gold-on-ink-text is already in the system (`PrimaryBtn` vs `GoldBtn` in
`src/components/Buttons.tsx:103-123`) but doesn't make it into builder
components. Use it.

### CC-3. The "Start when you're ready" CTA looks disabled
`BuilderClient.tsx:1964-1973` renders the Stage 1.0 CTA as a `PillPicker`
single-pill with `autoSubmitOnPick`. The pill's default unselected style is
`background: C.cream` with a `C.line` 1px border (`PillPicker.tsx:54-59`) —
indistinguishable from a disabled pill on the cream page background. There is
no shadow, no fill, no gold tone. The user reads it as a non-affordance.

**Fix:** Stage 1.0 should NOT use the PillPicker primitive. The welcome CTA
is the single most important affordance in the product — make it a dedicated
`AffirmBtn` (gold-keyed) placed *inside* the WelcomePanel, immediately under
WELCOME_LINES[3] ("Ready when you are."), with the new `affirmBtn` token.

### CC-4. The page has no progress indicator
The wizard runs 20+ stages and the only positional cue is `StageBanner` —
which tells the user the *name* of the current stage but not "you're 4 of 8
in intake" or "you're entering Stage 3 of 8." Grieving users feel time
differently. A subtle progress rail gives spatial certainty.

**Fix:** add a `BuilderProgressRail` (new component, see below) — a top-of-page
thin gold-on-line rail showing one filled segment per top-level stage
(intake / character sheet / format-theme-style / beat / storyboard / words /
card preview / cinematography / video / assembly / eulogy / delivery), with
the *current* segment subtly pulsed via the `breathPulse` motion token. Render
this above the StageBanner inside WizardShell. Skip rendering on Stage 1.0
welcome (the welcome is a held moment; no rail).

### CC-5. WizardShell's stage transition is the only motion the user sees
`WizardShell.tsx:50-60` wraps each stage in an AnimatePresence with a tiny
opacity-y transition (6px). That fade-up *is* the entire choreography between
stages. Inside the stage, components mount instantly — no entry choreography
on form labels, pills, or the GateReview pill row (except the artifact-bearing
gates which already use `staggerPills`). Result: stages feel "swapped" not
"unfolded."

**Fix:** wrap each builder-stage body in a `staggerChildren` container and
apply `fadeUp(6)` to each direct child (`question`, `pills`, `submit row`).
This is already imported in `GateReview.tsx:138-139` — apply it consistently in
`PillPicker`, `TextField`, `PhotoUrlField`, `ConfirmationCard`. The
choreography is: page enters → headline fades up → fields stagger in → CTA
arrives last. ~360ms total per stage.

### CC-6. Footer "Having trouble?" is the loudest passive element
`WizardShell.tsx:62-73` renders the `SHELL_COPY.stuck_footer` line with a
`C.inkSofter` color, 12px Inter, centered. It's literally always the lowest-
contrast text in the document but, because it's persistently visible while
every other piece of system voice copy comes and goes with stage transitions,
the user's eye keeps landing on it. It frames the entire wizard as "this
might break."

**Fix:** demote it. Wrap in a `HelpFooter` component (proposed) that
collapses to a single small icon + `?` label on desktop and only expands on
hover/focus to reveal the full sentence. On mobile, render the full sentence
but pin it to the bottom edge with a small top margin instead of the current
56px gap that draws attention to it.

### CC-7. Every loading panel re-defines its own spinner
Every loading panel (`CharacterSheetView`, `BeatSheetView`, `StoryboardView`,
`CombinationPreviewReview`, `CinematographyView`, `AssemblyView`, `EulogyView`,
`DeliveryReadyView`, `Loading` in `BuilderClient.tsx:3213-3239`) defines its
own `peternaSpin` keyframe inside a `<style>` tag inside the JSX. That's
nine duplicate keyframe declarations and nine slightly different spinner
sizes/colors (36/36/36/36/36/36/36/36/28).

**Fix:** lift to a shared `<LoadingPanel petName label hint />` primitive that
owns the keyframe, the spinner, and the headline/hint typography. Reduces
~250 lines of duplication and gives us one place to upgrade loading
choreography (e.g. swap the spinner for a soft pulse using `breathPulse`).

### CC-8. Focus states are inconsistent and `outline: none` is everywhere
`TextField.tsx:121, 99`, `PhotoUrlField.tsx:485, 487` and others set
`outline: "none"` with no `:focus-visible` replacement. The motion-button
primitives don't set focus rings at all. Keyboard users get no visible focus.

**Fix:** add a global `<style>` to the wizard root for `:focus-visible` on
buttons/inputs setting `box-shadow: 0 0 0 2px rgba(201,169,97,0.45)` (gold,
the system's already-warm accent) and never `outline: none` without that
replacement.

### CC-9. Italic is the default rather than the accent
Italic is used as the warmth signal across the system — it's on every display
headline, every reveal moment, every gate headline. But it's also used on
captions in BeatCard (`BeatCard.tsx:283`), on placeholders in BeatList
(`BeatList.tsx:78`), on scene labels in StoryboardFrameCard, on the loading
copy everywhere, and on the welcome's lines 1, 3, and 4. When everything
italic, nothing is. The screenshot Xee shared makes this clear.

**Fix:** establish a rule — italic is reserved for **display headlines and
reveal moments**. Body copy, captions, hints, and labels stay upright. The
WELCOME_LINES treatment specifically should be: line 1 italic (the
emotional opener), lines 2 + 3 upright (the informational frame), line 4
italic (the held closing line). The CTA below is NOT italic.

### CC-10. Two photo-form actions, no skip on first photo, ambiguous "Continue"
`PhotoUrlField.tsx:548-565` only renders the Skip pill on the `followup`
variant. The `first` variant has only a Continue button that's *disabled*
until something is uploaded — which is correct per spec (minimum 1 photo) but
gives the user no escape hatch on this very early screen if they're stuck
finding photos. Combined with the "Having trouble?" footer this reads as
"you can't proceed."

**Fix:** keep the constraint but show a quiet "I'll add photos later" link
under the dropzone — the link routes to `intake_name` (skipping the photo
gate, marking the session as "photos pending"), with a small reassurance
("You can add them anytime before the character sheet"). The existing
`photos_skipped` event in `state.ts:580-584` already accepts this transition;
this is a UI-only change.

## Per-stage findings + fixes

Each stage below cites the relevant file and the specific lines.

### Stage 1.0 — `intake_welcome` (WelcomePanel + Loading CTA)

**Files:** `WelcomePanel.tsx`, `BuilderClient.tsx:1964-1973`.

**Current state:** four large italic lines on cream, a 56px `C.line` border
below, then a 40px gap, then a single-pill PillPicker that reads as
disabled.

**Issues:**
1. The panel doesn't read as a separate surface (CC-1).
2. The CTA is below a hard rule — visually disconnected from "Ready when you
   are." (CC-3).
3. The CTA looks disabled (CC-3).
4. Everything is italic (CC-9).
5. No mount choreography — all four lines arrive simultaneously.

**Fixes:**
- Replace `background: C.cream` with `C.creamRaised` (new token) and add
  `borderRadius: 32, padding: '64px 40px 40px', boxShadow: '0 1px 24px
  rgba(42,33,27,0.06)'`, centered with `maxWidth: 720`.
- Remove the `borderBottom: 1px solid C.line` — the surface treatment carries
  the separation.
- Reserve italic for line 1 and line 4 only. Lines 2 + 3 stay upright in
  `C.inkSoft` (CC-9). Line 4 stays in `C.goldDeep` italic — that's the
  affordance the eye anchors on.
- **Move the CTA inside the panel.** Place a single `AffirmBtn` (gold-keyed,
  see CC-2) labeled "Start when you're ready" directly under line 4, with
  ~28px margin. The CTA inherits the panel's emotional envelope rather than
  reading as a disconnected next step.
- Choreograph the entry with `staggerChildren(0.12)` so the four lines fade
  up in sequence, then the CTA arrives last (~600ms total). Use `fadeUp(8)`
  per child. Honors prefers-reduced-motion automatically via `motion-tokens.ts:53`.
- Replace the PillPicker rendering in `BuilderClient.tsx:1964-1973` — the
  welcome owns its own CTA now. The PillPicker primitive isn't the right
  primitive for a single one-off CTA.

**Tokens used:** `C.creamRaised` (new), `C.ink`, `C.goldDeep`, `C.inkSoft`,
`FONT_DISPLAY`, `DURATION.slow`, `EASE.reveal`, `staggerChildren`, `fadeUp`.

### Stage 1.1 — `intake_returning_user_check`

**Files:** `BuilderClient.tsx:1975-1992`, `PillPicker.tsx`.

**Current state:** Two pills, autoSubmit on tap. No subhead, no progress.

**Issues:**
- The question feels abrupt right after the warm welcome. There's no soft
  framing line — the user goes from "Ready when you are" → a yes/no
  question with no transitional copy.
- The two pills are visually identical; "first time" and "returning" carry
  different emotional weight (a returning user is back because they lost
  another pet — that's significant).

**Fixes:**
- Add an optional `subhead` prop to `PillPicker.tsx` (already supports
  `hint` — promote a `subhead` slot above the question for emotional framing
  that's not constrained to small grey text).
- Soften the pill weighting: give the "Yes, I've done this before" pill a
  subtle `C.blush` background tint so it reads as a slightly different
  weight (this person has lived this before). Not aggressive — just a
  visual acknowledgement.

### Stage 1.2 — `intake_photos` (PhotoUrlField)

**Files:** `PhotoUrlField.tsx`.

**Current state:** dropzone + URL textarea + Continue button. Skip is only on
the followup variant. The dropzone background is `#FFFBF3` (raw hex,
inconsistent with token system — see also `PillPicker.tsx:71`).

**Issues:**
1. `#FFFBF3` is a raw hex repeated across PhotoUrlField, PillPicker, and many
   other components. Should be a token (call it `C.creamRaised` as proposed
   above — same value works).
2. No soft escape from a stuck first-photo state (CC-10).
3. The submit button disabled state uses `C.line` background — visually
   reads as "broken" rather than "complete this first." A grey-on-grey
   approach with helper text below ("Add at least one photo to continue")
   would be kinder.
4. The error state (`PhotoUrlField.tsx:498-512`) uses a raw `#8a4b2b` —
   should be a token (`C.warn` proposal — see "New tokens" below).
5. The drag-over state uses `rgba(201, 169, 97, 0.08)` — a raw rgba duplicated
   across PhotoUrlField, PillPicker, ConfirmationCard, RefinementPanel.

**Fixes:**
- Add tokens: `C.creamRaised` (#FFFBF3 or slightly different), `C.warn`
  (#8A4B2B or close), `C.goldGlow8` (rgba(201, 169, 97, 0.08)), `C.goldGlow18`
  (rgba(201, 169, 97, 0.18)).
- Replace the disabled-state visual: gray pill stays *enabled*-looking but
  with `cursor: default` and a small helper note "Add at least one photo
  to continue" rendered next to it in `C.inkSofter`. The button is then a
  confirmation of completeness, not a barrier.
- Add the soft "I'll add them later" skip per CC-10.
- Choreograph thumbnails on upload — when a photo finishes uploading, the
  thumbnail should fade-in via `scaleIn(0.94)` rather than pop. Currently
  (`PhotoUrlField.tsx:386-457`) thumbnails appear instantly.

### Stage 1.3 — `intake_name` + `intake_name_pronunciation`

**Files:** `TextField.tsx`, `BuilderClient.tsx:2012-2065`.

**Current state:** label + input + Continue (+ Skip on pronunciation step).

**Issues:**
- The label is 20px/500 — fine — but sits flush with the input. No air.
- The autoFocus is right (`TextField.tsx:88`) but the focus ring is invisible
  (`outline: "none"` at line 121). Keyboard users see nothing.
- Pronunciation step has good copy but no visual cue that it's *optional* —
  the skip pill is a small underline that reads as "leave" rather than
  "no pronunciation needed."

**Fixes:**
- Increase the label-to-input margin from `gap: 14` to `gap: 18` (closer to
  the BeatCard editor's rhythm at line 305).
- Add the global `:focus-visible` gold ring (CC-8).
- Rename the pronunciation skip label to match the locked copy
  `NAME_PROMPT.pronunciation_skip` ("Skip — it's read how it looks"). This
  IS the current locked string per `copy.ts:138` — verify the BuilderClient
  passes it through; if it falls back to "Skip" rename here.

### Stage 1.5 — `intake_vision_review` (ConfirmationCard)

**Files:** `ConfirmationCard.tsx`.

**Current state:** intro/observation paragraph + 4 tappable chips + accept +
"Let me fix something" toggle. Solid design overall.

**Issues:**
- The intro line at `ConfirmationCard.tsx:275-286` uses an uppercase
  letter-spaced micro-label style (`fontSize: 13, textTransform: uppercase,
  letterSpacing: 0.04em`) — reads like a kicker. Inconsistent with how other
  intros are styled (Stage 2 review uses italic display for headline). Pick
  one rhythm.
- The "Yes, that's [PET_NAME]" CTA is the same `C.ink` button as everywhere
  else (CC-2). This is the *first approval gate* in the product — it
  deserves the gold-keyed affirmation treatment.
- The "Let me fix something" toggle is a bordered ghost button (`:355-374`).
  When toggled to "Done editing" the visual doesn't change — users tap and
  wonder if it registered. Add a state shift (filled background on active).
- The chip grid uses `gridTemplateColumns: repeat(auto-fill, minmax(180px, 1fr))`
  — on narrow screens this collapses to one column, which is fine, but the
  chip cards then become quite tall because they have `padding: 12px 14px`
  per chip with stacked label + value. Cap the chip height.

**Fixes:**
- Promote the "Yes, that's [PET_NAME]" button to the new `affirmBtn` (gold-key).
- Add an `active` visual to the batch-edit toggle (background = `C.gold`-tinted
  when `batchEdit === true`).
- Replace the intro kicker with a quiet italic display line of the same
  weight as the StageBanner — keeps the editorial rhythm.
- Stagger the chip grid using `staggerChildren(0.05)` so the four chips
  cascade in below the observation paragraph (~200ms total).

### Stage 1.6 — `intake_memory` + `intake_memory_freetext`

**Files:** `BuilderClient.tsx:2070-2127`, `PillPicker.tsx`, `TextField.tsx`.

**Current state:** rich-pill picker with the memory prompts, then a TextField
follow-up.

**Issues:**
- The transition from the prompt-picker to the freetext follow-up is a hard
  stage swap — the user picks "a sound, a smell, a feeling" and the screen
  is replaced wholesale by a textarea. There's no continuity between "you
  picked this prompt" and "now answer it."

**Fixes:**
- On the freetext screen, render a small *chip* at the top showing which
  prompt the user picked (re-using the rich-pill's icon + label in a much
  smaller, non-interactive surface). Continuity wins.
- Add shared-element transition: as the picked pill fades on the picker
  screen, the same icon + label appear on the freetext screen via
  framer-motion's `layoutId` (works across AnimatePresence boundaries).

### Stage 1.7 / 1.8 / 1.9 / 1.10 — gender / relationship / traits / favorites

**Files:** `BuilderClient.tsx` (rendering), `PillPicker.tsx`.

**Current state:** Pattern B PillPicker, sometimes single-select autoSubmit,
sometimes multi-select with explicit Continue.

**Issues:**
- The `traits` and `favorites` screens are multi-select with min/max — the
  helper text ("Pick 2 or 3.") sits in `C.inkSofter` 13px. When a user has
  picked 2, no visual feedback says "good — you can submit now." The Continue
  button silently flips from grey to ink, but the connection between picking
  and gating isn't reinforced.
- The pill row is `flex-wrap` which on phone widths produces ragged rows —
  no problem, but the relationship picker (4 pills) reads as a flat list. A
  2x2 grid would be more deliberate.

**Fixes:**
- Add a live count line on multi-selects: "You've picked 2 — pick one more
  if you'd like" in `C.gold`-toned italic. Render below the chip grid and
  above the Continue row.
- Add an optional `gridColumns?: 1 | 2 | 'auto'` prop to PillPicker so callers
  can opt into a 2-up grid where it makes emotional sense (relationship,
  length picker).

### Stage 1.11 — `intake_creator` & 1.12 `intake_years`

**Files:** `TextField.tsx`.

**Current state:** Free-text with `allowEmpty` true and `onSkip` wired.

**Issues:**
- Both screens are *deliberately* skippable but the UI shouts neither. The
  Continue button is the same weight as the Skip pill (relatively).
- No "(optional)" cue next to the question.

**Fixes:**
- Add an optional `optional?: boolean` prop to TextField that renders an
  "(optional)" hint after the question label, in `C.inkSofter`.
- Map the Skip button to the affirmBtn-shaped flow: when `allowEmpty` is
  true and the field is empty, the Continue button label changes from
  "Continue" to the skipLabel — and a single tap commits as a skip. Less
  duplication, gentler ergonomics.

### Stage 1.13 — `intake_complete` (soft pause)

**Files:** `BuilderClient.tsx` (rendering of `STAGE_2_INTRO` from `copy.ts:261`).

**Current state:** "Hand-off" pause panel with locked copy and a CTA to begin
the character sheet.

**Issues:**
- The pause moment is a great breath — but if visualised the same as any
  other screen (banner + paragraph + button), it doesn't *feel* like a pause.

**Fixes:**
- Use `revealPanel` from `motion-tokens.ts:155-175` for the body fade-in
  (long ease-out + scale-in 0.97 → 1) — matches the character sheet reveal
  rhythm and signals "something new is starting." Drop a 12px gold rule under
  the headline as a visual anchor.

### Stage 2 — `character_sheet_render` + `character_sheet_review`

**Files:** `CharacterSheetView.tsx`, `GateReview.tsx`.

**Current state:** Genuinely strong. Loading panel has the right tone, the
reveal motion (long ease-out + breath pulse) is the cleanest moment in the
product, the gate pill row is staggered.

**Issues:**
- The "Looks great" pill is still `C.ink` — should be the new affirmBtn
  (gold-keyed) so the GATE feels like an affirmation, not a continue.
- The "Start over" pill (`variant: 'quiet'`) sits at the same vertical
  level as the other two pills. The hierarchy is: approve (primary),
  refine (danger-bordered), start over (quiet). Reading order is good but
  visual weight is even — start over should sit on its own line below, or
  be a smaller link.
- Refinement panel (`CharacterSheetView.tsx:367-379`) appears below the
  pills inline. It's a long form (chip group + textarea + actions). On
  mobile, the user has scrolled past the character sheet to reach the pills
  — and now the form pushes the artifact further off-screen. Solution: a
  collapsible bottom-sheet pattern (the form expands in place but the
  artifact stays sticky-visible at the top via a small thumbnail).

**Fixes:**
- Make "Looks great" the gold affirmBtn variant.
- Move "Start over" to a second row below the pill cluster, smaller font,
  underlined link style (already `quiet` variant in GateReview — just
  position it separately).
- For the refinement sub-panel, add a small `<aside>` slot inside that
  re-renders the character sheet thumbnail at ~120px wide, pinned to the
  top of the refinement panel. Reads as "you're correcting *this* image"
  rather than "you've left the image."

### Stage 2.5 — `length_pick` & 2.6 `aspect_pick`

**Files:** `LengthPicker.tsx`, `AspectPicker.tsx`, `PillPicker.tsx`.

**Current state:** Both use rich-pill PillPicker with autoSubmit. Both have
a `defaultSelected` (full / phone).

**Issues:**
- defaultSelected on autoSubmit means tapping the already-selected pill does
  nothing the user can see — but the autoSubmit timer (`PillPicker.tsx:120`)
  *does* fire. They tap the already-selected default, the screen advances
  80ms later, but the *visual feedback* of selection is identical to the
  pre-tap state. Confusing.
- The "Recommended" badge on the `full` length pill (`LengthPicker.tsx:41`)
  is rendered via the pill's `badge` field — currently a small pill-shaped
  micro-tag in `C.gold` tinted. It's the right idea but the recommendation
  isn't differentiated from a regular pill via the card itself. Add a
  subtle gold left-border or top-border on the recommended pill to make
  the recommendation legible *before* the user reads the badge.

**Fixes:**
- On a pill tap that matches the current `defaultSelected`, briefly pulse
  the pill (`scale: [1, 1.02, 1]` over 200ms) before the autoSubmit advance
  fires. Reads as "yes, that one."
- Add a `recommended?: boolean` prop to the Pill type. When true, render a
  2px `C.gold` accent on the leading edge of the card (left border on row
  pills, top border on column pills).

### Stage 3 — curators' pick / format / theme / style picks

**Files:** `CuratorPickGrid.tsx`, `FormatGrid.tsx`, `ThemeCategoryGrid.tsx`,
`ThemeGrid.tsx`, `StyleGrid.tsx`, `CuratorStyleConfirm.tsx`.

**Current state:** All compose `PillPicker` with `variant: 'rich'` and
`autoSubmitOnPick: true`.

**Issues:**
- Five very similar screens in a row with no visual differentiation. The
  user can lose track of which choice they're on.
- The CuratorPickGrid's "Based on what [PET_NAME] was to you" reorder
  subtitle (`CuratorPickGrid.tsx:54-67`) on the priority pick is rendered as
  the pill's description line — same typography as every other pill
  description. The reordering is meaningful editorial work that the user
  doesn't notice unless they're paying attention.

**Fixes:**
- Add a `categoryBadge?: string` slot to the WizardShell so each Stage 3
  sub-screen shows a small breadcrumb-style chip ("Format · Theme · Style ·
  3 of 4 chosen") at the top of the page. Helps the user see they're
  inside the same nested choice.
- Visually elevate the curator-pick priority match: render a small ribbon
  above the pill ("Picked for you — based on what [PET_NAME] was") with
  the gold tint, instead of cramming it into the description.

### Stage 3.5 — `combination_preview_review` (CombinationPreviewReview)

**Files:** `CombinationPreviewReview.tsx`.

**Current state:** Same reveal pattern as character sheet — good. Four pills
in the gate (approve / restart style / restart theme / restart all).

**Issues:**
- Four pills is the busiest gate in the wizard. The visual hierarchy reads
  flat: approve and the two "danger" restart-style/restart-theme pills are
  the same weight, then quiet "start over" at the end. The user has to
  read all four to understand the choices.
- "Try a different theme" and "Try a different style" are subtle distinctions
  for someone unfamiliar with stage 3's structure.

**Fixes:**
- Cluster the two restart pills into a single secondary cluster: a labeled
  group ("Adjust:") with two pills inside, indented from the primary
  approve pill above. Reads as a sub-menu of the rejection action.
- Or, simpler: collapse to three pills — "Looks beautiful" / "Adjust"
  (opens a small popover with the two specific restarts) / "Start over."

### Stage 4 — `beat_sheet_render` + `beat_sheet_review`

**Files:** `BeatSheetView.tsx`, `BeatList.tsx`, `BeatCard.tsx`.

**Current state:** Long list of beat cards, each collapsible for edit. The
gate offers approve / regenerate / start-over.

**Issues:**
- The list can be 8–16 cards tall. There's no jump-to-card affordance, no
  edit-all-inline mode. Edit-state is per-card via a toggle button.
- Caption-over-limit warning (`BeatCard.tsx:188-194`) uses `C.goldDeep`
  text — works, but it doesn't escalate visually as the user adds more
  words. The counter pre-warning (`BeatCard.tsx:181-185`) uses opacity 0.7
  on the "(N words left)" — too quiet.
- The Edit/Done button per card is a quiet pill — when the user is editing
  beat 5 and beat 7 simultaneously, two cards are open and there's no
  visual cue at the list level that two cards have unsaved edits.

**Fixes:**
- Add an "Edit all" pill to the gate that flips every card open at once.
- Pulse the caption counter in `C.gold` when the user is within 3 words of
  the limit (use `breathPulse`-style 1Hz fade between `C.inkSofter` and
  `C.goldDeep`). Inline progress as the eye approaches the wall.
- When a card is in edit mode, highlight its left border in `C.gold` so the
  user can scroll the list and spot active edits at a glance.

### Stage 5 — storyboard render / review / per-frame reroll

**Files:** `StoryboardView.tsx`, `StoryboardGrid.tsx`, `StoryboardFrameCard.tsx`,
`StoryboardFrameReview.tsx`.

**Current state:** N-frame grid, per-card reroll, gate review with approve +
start-over.

**Issues:**
- The frame card's "See details" toggle (`StoryboardFrameCard.tsx:62`) opens
  the caption inline. Each tap is a state change but the card doesn't visibly
  expand smoothly — it jumps.
- Rerolling state is *per-card* with a soft spinner overlay — good. But the
  card's "Looks good" / "Try this scene differently" pills (the mini-gate)
  open below the card and push the grid down. On phone, this means tapping
  a frame in row 2 causes row 3 to scroll off.

**Fixes:**
- Use framer-motion `<motion.div>` with `layout` and `transition: { duration:
  DURATION.quick }` for the caption + mini-gate expand. Smooth.
- For the mini-gate, render it as a non-pushing popover anchored to the
  card (positioned absolute over the card's lower edge with a small backdrop
  blur on the card behind). Keeps the grid stable.

### Stage 5.5 — `words_render` / `words_editor` (WordsEditor)

**Files:** `WordsEditor.tsx`.

**Current state:** Four sections (opening / closing / music / narration) in a
single long form. Defaults are generous.

**Issues:**
- Four sections is a lot for one screen. There's no visual division between
  them; they read as one wall.
- Music pills (`MUSIC_TRACKS`) are mid-density rich pills — visually similar
  to every other rich-pill row, so they blend into the form.
- Narration is opt-in (off by default) but the voice picker still renders —
  taking visual space the user might not need.

**Fixes:**
- Add `<section>` wrappers per group with a quiet display-italic kicker per
  section ("How it opens," "How it closes," "How it sounds," "A voice — if
  you'd like one"). Adds editorial rhythm.
- Collapse narration by default to a single "Add a voiceover" affordance;
  tapping expands the voice picker + textarea. Keeps the screen quiet for
  users who don't want narration.

### Stage 5.6 — `card_preview_render` + `card_preview_review`

**Files:** `CardPreviewView.tsx`.

**Current state:** Three stills stacked vertically with the gate.

**Issues:**
- The three cards stack without labels — the user is meant to infer
  "opening / in-scene / closing." A tiny label per card would help.

**Fixes:**
- Add a small italic kicker above each card ("Opening" / "A caption in the
  story" / "Closing"). Match the WordsEditor section kicker treatment.

### Stage 5.7 — cinematography brief / render / review

**Files:** `CinematographyView.tsx`, `CinematographyTable.tsx`,
`CinematographyCell.tsx`.

**Current state:** Picker → loading → review table. The table is the most
information-dense screen in the wizard.

**Issues:**
- The picker landing is fine. The table — by spec — has to show every column
  per beat (the "shot-list scan" goal). On a phone, this horizontal-scroll
  table can feel overwhelming when the user just expected another "approve"
  gate. There's no progressive disclosure or summary view.
- Per-cell inline edit (dropdown) on a table on a phone is brittle; tapping
  the cell, picking a value, and dismissing the dropdown is multi-step.

**Fixes:**
- On phone widths, render a **list view** of beats with a small chip cluster
  per beat showing the key fields (lens / camera move / motion). Each chip
  taps to edit. The full table is for tablet+. Same data, different shape.
- Add a "Looks fine, don't read" affordance at the top of the table —
  literally: "Want to skim and approve? These are the camera notes our
  director writes for you. Pick *Looks great* below, or scroll through
  to fine-tune." Calms the user who's just hit a 9-column table.

### Stage 6 — `video_render` (VideoRenderProgress)

**Files:** `VideoRenderProgress.tsx`.

**Current state:** Per-clip grid card with status badge + storyboard
thumbnail. Pulsing card outline while rendering. Solid.

**Issues:**
- The progress bar (`VideoRenderProgress.tsx:384-398`) is `C.goldDeep` on a
  `rgba(0,0,0,0.06)` track — good contrast, but the track color is a raw
  rgba and inconsistent with token system.
- "Polling hint" copy at the bottom (`:148`) reads centered and small —
  fine, but when paired with the persistent shell footer ("Having
  trouble?…") the bottom of this screen has two competing pieces of system
  voice.
- Failed clip's `errorHint` (`:246-250`) shows raw error text from the
  vendor in some cases. Lock the error language to a quiet stock phrase
  ("That scene didn't quite work — let's try again") regardless of vendor
  payload.

**Fixes:**
- Tokenize the progress track background (`C.inkDim8` or similar).
- Hide the shell footer (CC-6) on long-render screens — they have their
  own polling hint.
- Replace vendor error text with a single locked string from `copy.ts`.

### Stage 7 — `assembly_render` + `assembly_review`

**Files:** `AssemblyView.tsx`.

**Current state:** Loading panel during stitch, then a `<video>` with native
controls inside a GateReview. Reveal motion is the same as the character
sheet (good).

**Issues:**
- The video poster (first frame) is whatever the file's first frame is —
  often a black title card. The player frame's background is `#0F0E0C`
  (raw hex, near-black). Black-on-black for a few seconds before the user
  hits play. Add a soft "Tap to play" overlay using the storyboard's first
  frame as the poster.
- The three gate pills (approve / restitch / reroll clips) are well chosen
  but "Re-stitch" and "Re-render specific clips" are subtle distinctions.

**Fixes:**
- Use the storyboard's beat-0 frame as the `<video poster>` prop, falling
  back to the cinematography frame_vision result if available.
- Add a small icon next to each non-approve pill — `Scissors` for restitch,
  `Repeat` for reroll-clips. Visual disambiguation for the two restart
  flows.

### Stage 8 — eulogy render / review

**Files:** `EulogyView.tsx`.

**Current state:** Loading panel, then PDF iframe with the standard gate.

**Issues:**
- The iframe (`EulogyView.tsx:129-140`) uses `aspect-ratio: 8.5 / 11` which
  on a phone width gives a tall PDF preview — the user has to scroll inside
  the iframe AND inside the page. Two scroll-axes is hostile.
- The "PDF not loading? Open it in a new tab" fallback (`:142-155`) is
  shown unconditionally — even when the PDF renders fine. The fallback is
  good engineering but the always-on copy makes the screen feel apologetic.

**Fixes:**
- Detect mobile (or just always-on for narrow viewports) and replace the
  iframe with a thumbnail of page 1 of the PDF + a primary "Open the
  eulogy" CTA. Don't try to embed on phones.
- Hide the "PDF not loading?" line until you've detected it didn't load
  (a `setTimeout(check, 1500)` polling the iframe's load state); show it
  only if needed.

### Phase 9 — `delivery_ready` / `delivery_emailed` (DeliveryReadyView)

**Files:** `DeliveryReadyView.tsx`.

**Current state:** Hero + share block + email form + artifacts grid + push
opt-in. Completion haptic fires once.

**Issues:**
- The "Download the eulogy" button uses `C.gold` directly
  (`DeliveryReadyView.tsx:586`) — finally a real gold affirmation
  button. But it's the *only* place in the entire wizard the gold treatment
  is applied. Once you've seen this, every other "Continue" button in the
  wizard looks like a missed opportunity.
- The artifacts grid is small (cards at 140px) and the labels are 12px
  Inter. Compared to the editorial display-font moments throughout the
  wizard, this is the most "feature page" looking screen.
- The push opt-in (`NotificationOptIn`) is rendered twice in different
  scopes (video render + delivery). Both surfaces need to ensure the
  "no thanks" dismissal locks out re-prompts.

**Fixes:**
- Use the artifacts grid as the model for the affirmBtn treatment everywhere
  — start there, then generalize back into Stage 1 / 2 / 3 gates.
- Use `FONT_DISPLAY` italic for the artifact label (matches the
  artifactsHeading at line 678-687) instead of `FONT_SANS` 12px. Aligns
  with the wizard's editorial voice.
- Re-render larger artifact thumbnails on tablet+ (drop to 140px only on
  phone, use 200px minimum on tablet).

## New shared components to add

### `BuilderProgressRail` — new

**Location:** `src/components/builder/BuilderProgressRail.tsx`

**Purpose:** thin top-of-page progress rail showing one segment per top-level
stage. Driven by `bannerKeyForStage(stage)` so it's a pure function of the
current stage tag.

**API:**
```ts
type Props = {
  currentBannerKey: ReturnType<typeof bannerKeyForStage>;
  petName: string | null;
};
```

**Render:** 12 segments (intake, character_sheet, format_theme_style, beat_sheet,
storyboard, words, card_preview, cinematography, video, assembly, eulogy,
delivery). Segments before current = `C.gold`. Current segment = `C.gold`
with `breathPulse` motion. Future segments = `C.line`.

Renders inside `WizardShell` above `StageBanner`. Skips Stage 1.0 (welcome)
because the welcome is a held moment.

### `PageSurface` — new

**Location:** `src/components/builder/PageSurface.tsx`

**Purpose:** consistent "raised surface" wrapper. Replaces the ad-hoc
`background: '#FFFBF3' border: 1px solid C.line borderRadius: 18 padding…`
boilerplate that's repeated in ~12 components.

**API:**
```ts
type Props = {
  children: ReactNode;
  variant?: 'panel' | 'card' | 'hero';   // padding + radius scale
  padded?: boolean;                       // default true
  ariaLabel?: string;
};
```

### `HelpFooter` — new

**Location:** `src/components/builder/HelpFooter.tsx`

**Purpose:** demoted "Having trouble?…" line. Collapsed by default, expands
on hover/focus. See CC-6.

### `LoadingPanel` — new

**Location:** `src/components/builder/LoadingPanel.tsx`

**Purpose:** shared loading skin. Owns the spinner keyframe, headline + hint
typography, the breath-pulse alternative for prefers-reduced-motion.

**API:**
```ts
type Props = {
  headline: string;        // pre-substituted
  hint: string;
  minHeight?: number;
};
```

Replaces the 9 ad-hoc loading panels. ~250 line reduction.

### `AffirmBtn` / `ProgressBtn` / `QuietBtn` — new

**Location:** `src/components/builder/buttons.tsx` (note: under `builder/`, not
top-level `Buttons.tsx`, since the builder uses different sizing than the
landing pages).

**Purpose:** three semantic builder buttons (see CC-2). Internally consume the
landing-page `Buttons.tsx` primitives where possible.

### Animation: `staggerBody(children)` helper — new

**Location:** add to `motion-tokens.ts`

A small util that takes a children array and returns the motion-wrapped
container + child elements with `fadeUp` per child. Used by every stage body
in `BuilderClient.tsx#renderStage` to lift the "screen-level mount choreography"
into a single function call (CC-5).

## Animation choreography upgrades

Concrete per-stage motion plan, using tokens from `motion-tokens.ts`:

- **Stage 1.0 welcome (CC-3, CC-5):** `staggerChildren(0.12, 0.04)` container,
  `fadeUp(8)` for each WELCOME_LINES paragraph + CTA. Total ~600ms with the
  CTA arriving last. The CTA itself runs `breathPulse` once on mount.

- **Every Stage 1 form screen:** outer `staggerChildren(0.06)`; `fadeUp(6)` on
  the question/label, the input or pill row, the submit row. Total ~300ms.

- **Stage 1.6 prompt → freetext transition:** shared-element `layoutId`
  between the picked prompt's pill and the freetext header chip.

- **Stage 1.13 / 3 / 4 / 5 / 5.5 / 5.6 / 5.7 / 6 / 7 / 8 hand-off screens:**
  `revealPanel()` container — long ease-out, gentle scale-in. Signals "we're
  arriving somewhere."

- **Stage 2 character sheet review:** keep current (it's strong). Add
  affirmBtn variant on the Looks Great pill.

- **Stage 4 beat sheet review:** stagger the BeatList items with
  `staggerChildren(0.04)` and `fadeUp(4)` per BeatCard. Reads as the sheet
  arriving in order.

- **Stage 5 storyboard review:** stagger the StoryboardGrid items with
  `staggerChildren(0.06)` and `scaleIn(0.96)` per card. Cards fade-in like
  a contact sheet.

- **Stage 6 video render progress:** when a clip transitions from
  `rendering` → `done`, run a single `scaleIn(0.98)` on the card + a soft
  flash of the badge (opacity 0.6 → 1 → 0.8 → 1 over 600ms).

- **Stage 7 assembly review:** keep current (it's strong).

- **Phase 9 delivery ready:** keep current `DeliveryReadyView`'s
  `motion.section initial/animate`. Add a `staggerChildren(0.08, 0.2)` so the
  hero, share block, email form, artifacts grid arrive in sequence over ~1s.
  This is the *closing moment* — give it ceremony.

- **AnimatePresence between stages:** keep `WizardShell.tsx:50-60`'s
  `mode="wait"` with opacity-y. Increase the y from `6` to `12` so the
  out-going stage has a more legible departure, and bump the exit duration
  to `DURATION.quick` (currently inherits `base` → quick on exit isn't
  defined explicitly).

## Contrast + accessibility

WCAG checks against the token palette (background `C.cream` = #F8F1E4,
luminance ~94%):

| Foreground | Background | Ratio | Status |
|---|---|---|---|
| `C.ink` #2A211B | `C.cream` #F8F1E4 | **13.0:1** | Pass AAA body |
| `C.inkSoft` #4A3F36 | `C.cream` | **8.8:1** | Pass AAA |
| `C.inkSofter` #7A6F66 | `C.cream` | **4.4:1** | **Fails** AA body (<4.5) — borderline. Avoid for body copy; OK for hints (the footer "Having trouble?" is one such use — see CC-6, which proposes demoting it anyway). |
| `C.gold` #C9A961 | `C.cream` | **2.0:1** | Decorative only — never use for text. |
| `C.goldDeep` #A88841 | `C.cream` | **3.0:1** | Borderline for large text only. The italic 24px `C.goldDeep` in WELCOME_LINES line 4 is OK (large text threshold ≥3.0). |
| `C.sage` #8FA68E | `C.cream` | **2.7:1** | Decorative only. Currently used as text color in `DeliveryReadyView.tsx:651-657` (the email success line) — **fails** WCAG. Fix: use `C.ink` text with a `C.sage` left-border icon instead. |
| `C.cream` on `C.ink` (inverse) | | 13.0:1 | Pass — button text on dark CTAs. |

**Specific accessibility findings:**

- **No focus-visible rings on any custom button** (CC-8). All `motion.button`
  uses inherit `outline: none` from browser defaults. Fix: global
  `:focus-visible` rule with a 2px gold ring.

- **Email success text fails contrast** (`DeliveryReadyView.tsx:651-657`).
  Currently `color: C.sage` (~2.7:1). Move to `C.ink` with a sage check icon.

- **Disabled button visual is ambiguous** — `PillPicker.tsx:288-291`,
  `TextField.tsx:143-145`, `PhotoUrlField.tsx:531-533` set background
  to `C.line` and text to `C.inkSofter` on disabled. The disabled pill ratio
  is 4.4:1 (`inkSofter` on `line` ~= `inkSofter` on cream — close to
  4.5:1 borderline). Better: keep the ink/cream colors but reduce opacity to
  0.55 and add `cursor: not-allowed` + an inline helper sentence.

- **Vision-failure card** (`ConfirmationCard.tsx:80-145`) is gracefully built
  but the headline is `FONT_DISPLAY italic 24px C.ink` and the subhead is
  14px `C.inkSoft` — both pass WCAG. Good.

- **Keyboard navigability:**
  - PillPicker pills are `role="checkbox"` / `role="radio"` with
    `aria-checked` — good.
  - GateReview pills are plain `<button>` — fine, but the group has no
    `role="group"` aria-labelledby tying back to the headline. Add
    `aria-labelledby` on the pill row pointing at the headline `<h2>` id.
  - BeatCard's edit toggle uses `aria-expanded` + `aria-controls` — good.
  - The character-sheet refinement panel is conditionally rendered without
    `tabIndex={-1}` focus management. When the user picks "Needs tweaks"
    the panel slides in but keyboard focus stays on the pill — they then
    tab past the artifact, through the rejected pills, before reaching the
    refinement chips. Move focus into the refinement panel on mount.
  - No `Escape` handler on inline-edit modes (BeatCard editor, Confirmation
    chip editor). Pressing Esc should cancel + close.

- **Screen-reader announcements:**
  - Loading panels use `role="status" aria-live="polite"` — good.
  - State changes (stage transitions) don't announce. Consider an off-screen
    `<div role="status" aria-live="polite">{stageBannerText}</div>` updated
    on stage change so screen reader users hear "Stage 2: Character sheet —
    locking [PET_NAME]'s likeness" on transition.

- **prefers-reduced-motion** is honored by the motion-tokens helpers but the
  inline `motion.div` declarations across components don't all funnel through
  the helpers. Specifically: the character sheet reveal animation
  (`CharacterSheetView.tsx:213-228`) sets explicit `transition.duration` and
  `times` arrays without checking `prefersReducedMotion()`. Same for
  CombinationPreviewReview, AssemblyView, EulogyView reveals. Audit and route
  through helpers.

## Prioritized fix list

The top 10 most impactful changes, ordered. Each is small in scope, large in
visible result.

1. **Stage 1.0 welcome — surface treatment + CTA inside panel + entry
   stagger** (`WelcomePanel.tsx`, `BuilderClient.tsx:1964-1973`). Fixes the
   exact issue Xee screenshotted. ~1 day of work; immediately changes the
   first 30 seconds of the product.

2. **Introduce the three semantic buttons** (`builder/buttons.tsx` new;
   refactor sites in `PillPicker`, `TextField`, `PhotoUrlField`,
   `ConfirmationCard`, `GateReview`). Gold-keyed `AffirmBtn` on the *one*
   primary action per gate gives the user a clear "this is the choice"
   signal across the entire wizard. ~1 day.

3. **Add the `BuilderProgressRail`** (new component, mounted in
   `WizardShell.tsx`). Gives spatial certainty across the 20-stage journey.
   ~0.5 day.

4. **Add global `:focus-visible` gold ring** (single `<style>` block in
   `WizardShell.tsx` or `app/builder/page.tsx`). Wins WCAG keyboard
   accessibility instantly. ~30 min.

5. **Demote the "Having trouble?" footer to a `HelpFooter` collapsible**
   (`WizardShell.tsx`, new `HelpFooter.tsx`). Stops framing every stage as
   "this might break." ~0.5 day.

6. **Lift loading-panel boilerplate into a shared `LoadingPanel`**
   (~9 callsites, all loading screens). Reduces duplication and gives one
   place to improve loading choreography later. ~0.5 day.

7. **Stage-body entry stagger** (`PillPicker.tsx`, `TextField.tsx`,
   `PhotoUrlField.tsx`, `ConfirmationCard.tsx` — wrap each top-level body in
   `staggerChildren` + `fadeUp` per child). Every form screen mounts with
   choreography. ~0.5 day total.

8. **Italic-only-for-headlines pass** (per-component sweep — strip italic from
   body copy, captions, hints in BeatCard, BeatList, StoryboardFrameCard,
   loading panels, WELCOME_LINES 2 + 3). ~0.5 day.

9. **Refactor raw hex repeats into tokens** (`#FFFBF3` → `C.creamRaised`,
   `rgba(201,169,97,0.08)` → `C.goldGlow8`, `#8a4b2b` → `C.warn`, etc.). One
   pass through `src/components/builder/`. Cleans up the system and gives
   the next designer a real token set. ~0.5 day.

10. **Add the multi-select live count + the recommended-pill accent**
    (`PillPicker.tsx` — add the live count line; add `recommended?: boolean`
    field to `Pill` type and render a 2px gold leading edge). Improves the
    feedback loop on every multi-select screen and disambiguates the
    "Recommended" badge from a regular description. ~0.5 day.

Lower-priority but worth queueing after the top 10: the cinematography
mobile-list view (Stage 5.7), the eulogy mobile fallback (Stage 8), the
storyboard mini-gate popover (Stage 5), and the email-success contrast fix.
