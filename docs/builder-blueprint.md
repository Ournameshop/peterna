# BLUEPRINT — Peternal Full-Pipeline Builder Wizard

> Implementation blueprint for integrating the Peternal skill (v2.3) into the `/builder` web flow.
> Coders: read this file fully before writing code. Build straight from it — no further design decisions.

## 0. Context, constraints, and key decisions

**What exists today.** The builder is a single 1,873-line file (`@ts-nocheck`) at `src/app/builder/page.tsx`. It is a `"use client"` page with 8 screens covering ~half the skill. It owns its own `PALETTE` (a near-duplicate of `src/lib/peterna-tokens.ts` — `bone`/`espresso`/`brass` vs `cream`/`ink`/`gold`), its own primitives (`Serif`, `Sans`, `Eyebrow`, `PrimaryButton`, `Pill`, `StageShell`, `FieldGroup`, `ChoiceCard`, `PathCard`, `Tag`, `SummaryItem`), bespoke SVG art (`PetSketch`, `StyleSwatch`, `FormatThumb`, `BeatScene`, `Waveform`), inline library data (`FORMATS`, `THEME_CATS`, `STYLES`, `CURATORS_PICKS`, `TRAITS`, `FAVORITES`, `LENGTHS`, `ASPECTS`), a `STEPS` array, and one `PeternaPrototype` component holding a flat `data` object with `update`/`next`/`back`.

**Target.** Full parity with the Peternal skill v2.3: every stage and all 3 gates get a screen, with genuine deterministic logic for the beat-sheet generator, the 4-part Cinematography Engine, Curator's-pick reordering, and pronoun/vocative resolution.

**Scope locks (carry verbatim into every coder ticket).**
- Front-end only. No API calls, no backend, no keys. All "generation" is a simulated progress state plus the existing SVG/placeholder art.
- The 4 named deterministic systems must *actually compute*. They are pure TypeScript in `src/lib/`, unit-testable, no randomness except a single seeded helper.
- Honor the skill's gentle tone: no "X credits", no "are you sure", re-rolls framed as care.
- Reuse the builder's existing `PALETTE` and primitives — do NOT switch to `peterna-tokens.ts` mid-stream (see Decision D1).

**Decision D1 — keep the builder's `PALETTE`.** `PALETTE` and `C` describe the same hexes under different names. Merging them is a premature cross-cutting refactor that touches the whole marketing site. Instead: move `PALETTE` verbatim into `src/app/builder/lib/palette.ts` and re-export. The builder stays self-contained.

**Decision D2 — drop `@ts-nocheck`, but the directory stays a leaf.** New files are real typed TS. Keep `@ts-nocheck` only on the legacy art SVG components during migration, then remove it in the final wave.

**Decision D3 — React Context for state, not prop-drilling.** Justified in Section 3.

**AGENTS.md note.** `AGENTS.md` instructs reading `node_modules/next/dist/docs/` before Next.js code. That directory does not exist in this install. There is no new Next.js surface here: `/builder` is and remains a single `"use client"` route with no server components, no route handlers, no `metadata` export, no data fetching. Coders must NOT add server components, `loading.tsx`, `route.ts`, or `generateMetadata` to the builder directory. If any coder believes a Next-specific API is needed, that is a STOP — escalate.

---

## 1. File structure

Refactor the monolith into `src/app/builder/` with three subdirectories plus a shared library in `src/lib/`. One component per stage.

```
src/lib/
  peternal-library.ts        # NEW — typed asset library (Section 2). Pure data + types.
  peternal-resolvers.ts      # NEW — pronoun/vocative resolver, curator reorder, defaults (Section 2.4)
  peternal-beatsheet.ts      # NEW — deterministic beat-sheet generator (Section 6.0)
  peternal-cinematography.ts # NEW — the 4-part Cinematography Engine (Section 6)
  peterna-tokens.ts          # UNCHANGED

src/app/builder/
  page.tsx                   # SHRINKS to ~40 lines: "use client", <BuilderProvider><Wizard/></BuilderProvider>
  state.ts                   # NEW — BuilderState type, initialState, BuilderContext, useBuilder hook (Section 3)
  steps.ts                   # NEW — STEP_GROUPS + STEPS registry, gate markers (Section 4)

  lib/
    palette.ts               # NEW — PALETTE moved here verbatim, exported
    primitives.tsx           # NEW — Serif, Sans, Eyebrow, PrimaryButton, Pill, StageShell,
                             #       FieldGroup, ChoiceCard, PathCard, Tag, SummaryItem,
                             #       GateReview (NEW), ApprovalPills (NEW), EditChip (NEW)

  art/
    PetSketch.tsx            # MOVED verbatim
    StyleSwatch.tsx          # MOVED verbatim
    FormatThumb.tsx          # MOVED verbatim
    BeatScene.tsx            # MOVED verbatim
    Waveform.tsx             # MOVED verbatim
    CardArt.tsx              # NEW — title/closing/caption card preview SVG (Stage 5.6)
    index.ts                 # barrel re-export

  shell/
    Wizard.tsx               # NEW — step router, owns step index, renders active stage
    ProgressRail.tsx         # NEW — replaces ProgressDots; shows GROUPS + 3 GATE markers (Section 4)
    TopBar.tsx               # MOVED, restyled to host ProgressRail

  stages/                    # ONE FILE PER SKILL SCREEN. All take ({ onNext, onBack }) + useBuilder()
    Welcome.tsx              # Stage 1.0
    ReturningUser.tsx        # Stage 1.1
    Photos.tsx               # Stage 1.2  (file dropzone + URL field — Pattern A)
    NameGender.tsx           # Stage 1.3 + 1.7  (name, pronunciation, gender)
    VisionConfirm.tsx        # Stage 1.4 + 1.5  ("Here's what I see" card)
    MemoryRelationship.tsx   # Stage 1.6 + 1.8  (memory prompt + relationship)
    TraitsFavorites.tsx      # Stage 1.9 + 1.10 (traits + favorite things)
    CreatorYears.tsx         # Stage 1.11 + 1.12 (creator name + years)
    CharacterSheet.tsx       # Stage 2  [GATE 1]
    LengthAspect.tsx         # Stage 2.5 + 2.6
    CuratorsPicks.tsx        # Stage 3.1  (relationship-reordered)
    StyleConfirm.tsx         # Stage 3.1.5
    FormatPick.tsx           # Stage 3.2
    ThemePick.tsx            # Stage 3.3  (category screen + theme screen, internal sub-step)
    StylePick.tsx            # Stage 3.4
    CombinationPreview.tsx   # Stage 3.5
    BeatSheet.tsx            # Stage 4    (renders generated beats; minor approval)
    CaptionContainer.tsx     # Stage 4.5  (13 containers, 2 groups)
    Storyboard.tsx           # Stage 5    [GATE 2]
    TheWords.tsx             # Stage 5.5  (internal 6 sub-stages)
    CardPreview.tsx          # Stage 5.6
    Cinematography.tsx       # Stage 5.7  [GATE 3]  (engine review table + per-scene editor)
    Generate.tsx             # Stage 6
    FinishedTribute.tsx      # Stage 7 + 8 (final tribute + eulogy PDF offer)
    index.ts                 # barrel re-export
```

**Notes on the structure.**
- `stages/` files never import each other. Each imports only `useBuilder`, `lib/primitives`, `art/`, and `src/lib/peternal-*`. This is what makes Wave-3 parallelization conflict-free.
- The combined screens (`NameGender`, `VisionConfirm`, `MemoryRelationship`, `TraitsFavorites`, `CreatorYears`) merge adjacent skill sub-stages that share an emotional beat — keeps the wizard from ballooning to 30 screens while preserving full data parity. Each combined screen has internal section headers naming the skill sub-stages.
- `ThemePick.tsx` and `TheWords.tsx` keep their own internal sub-step `useState` (category→theme; opening→closing→captions→music→narration→review). Matches the existing `Direction` component's `subStep` pattern.

---

## 2. Shared library module — `src/lib/peternal-library.ts`

Pure data, no React import. Every export is `as const` with an accompanying TypeScript type. Single source of truth.

### 2.1 Exact typed exports

```ts
// ---- ID union types (derive everything else from these) ----
export type FormatId = 'music_video'|'biopic'|'day_in_the_life'|'letter'|'greatest_hits'|'send_off'|'postcards'|'forever_young';
export type ThemeCategoryId = 'healing_and_peace'|'quiet_grief'|'home_and_everyday_love'|'nature_and_freedom'|'their_personality'|'spiritual_and_symbolic';
export type ThemeId = 'rainbow_bridge'|'sunrise_reunion'|'gentle_rain'|'moonlight_vigil'|'quiet_home'|'beloved_places'|'golden_meadow'|'endless_shore'|'forever_playful'|'nap_champion'|'starlit_reunion'|'signs_and_symbols';
export type ArtStyleId = 'cinematic_realism'|'watercolor'|'storybook_illustration'|'animated_3d'|'claymation'|'pencil_sketch'|'pixel_art'|'voxel_minecraft';
export type ContainerId =
  // 8 style-paired
  | 'cinematic_lower_third'|'watercolor_ribbon'|'storybook_page'|'parchment_scroll'
  | 'plasticine_banner'|'paperclip_note'|'pixel_sign'|'voxel_sign'
  // 5 memorial
  | 'engraved_stone_plaque'|'polaroid_border'|'postcard_back'|'embroidered_sampler'|'pressed_flower_bookmark';
export type CuratorPickId = 'classic_send_off'|'joyful_celebration'|'quiet_goodbye'|'storybook_for_them'|'quiet_remembrance'|'forever_in_stone';
export type RelationshipId = 'childhood'|'partnership'|'companion_through_grief'|'family_first'|'rescue_last_chapter'|'always_mine'|'unspecified';
export type Gender = 'male'|'female'|'neutral';
export type AspectId = '9:16'|'16:9'|'1:1'|'all_three';
export type DpStyleId = 'none'|'deakins_minimalist'|'lubezki_natural'|'young_intimate'|'khondji_painterly'|'wong_kar_wai_dreamy';
export type BeatArchetype = 'open'|'memory'|'connection'|'ceremonial'|'release'|'close';

// ---- exported data ----
export const formats: readonly Format[]                  // 8 — from FORMATS in current page.tsx (keep imagePrompt)
export const themeCategories: readonly ThemeCategory[]   // 6
export const themes: readonly Theme[]                    // 12 — flatten THEME_CATS, keep gradient + imagePrompt
export const artStyles: readonly ArtStyle[]              // 8 — keep emoji, directive, eligibleForCuratorsPick
export const captionContainers: readonly CaptionContainer[]  // 13 (Section 2.2)
export const curatorsPicks: readonly CuratorPick[]       // 6 (Section 2.3 — ADD quiet_remembrance, forever_in_stone)
export const relationships: readonly Relationship[]      // 7 — from skill YAML, with curatorsPickPriority + biases
export const memoryPrompts: readonly MemoryPrompt[]      // 3
export const personalityTraits: readonly PersonalityTrait[]  // 10 — id, label, phrase, adjectiveTag
export const favoriteThings: readonly FavoriteThing[]    // 12 — id, label, sceneHint  (CRITICAL: sceneHint feeds beat sheet)
export const openingArchetypes: readonly Archetype[]     // 9 — id, name, group, template
export const closingArchetypes: readonly Archetype[]     // 9
export const captionTemplates: Record<string, string[]> // 9 keys — sunbeam, favorite_toy, car_ride, quiet_pause, familiar_gaze, threshold, glance_back, joyful_release, custom
export const musicTracks: readonly MusicTrack[]          // 9 — id, name, description, mood, pairsWith[], styleMatch[]
export const narrationVoices: readonly NarrationVoice[]  // 4
export const lengths: readonly LengthOption[]            // 3 — id(min), beatCount, label, subtitle
export const aspects: readonly AspectOption[]            // 4 — INCLUDING all_three
export const pronounsAndVocatives: Record<Gender, PronounSet>  // Section 2.4
export const beatStructures: Record<8|12|16, BeatArchetype[]>  // Section 6 — the arc templates
export const cinematographyEngine: CinematographyEngineSchema  // Section 6.1
export const dpStyleLibrary: readonly DpStyle[]          // 6 (Section 6.4)
```

**Sourcing rule for coders.** `formats`, `themes`, `artStyles`, `curatorsPicks` (first 4), `lengths`, `aspects` data already exist as `FORMATS`/`THEME_CATS`/`STYLES`/`CURATORS_PICKS`/`LENGTHS`/`ASPECTS` in the current `page.tsx` — copy the objects verbatim including every `imagePrompt`, `gradient`, `directive`, `emoji`. `relationships`, `memoryPrompts`, `personalityTraits`, `favoriteThings`, `openingArchetypes`, `closingArchetypes`, `captionTemplates`, `musicTracks`, `narrationVoices`, `pronounsAndVocatives` are transcribed verbatim from the skill's `## EMBEDDED ASSET LIBRARY` YAML (SKILL lines 1297–2118). `personalityTraits` and `favoriteThings` in the current `page.tsx` are plain string arrays (`TRAITS`, `FAVORITES`) and MUST be upgraded to the full objects with `phrase`/`sceneHint` — the beat sheet depends on `sceneHint`.

### 2.2 The 13 caption containers — `captionContainers`

Two groups. Each entry: `{ id, name, group: 'style_paired'|'memorial', pairedStyle?: ArtStyleId, leafIcon: boolean, spec: string }`. The `spec` string is the verbatim illustrated-object specification.

**Style-paired (8), `group: 'style_paired'`** — one per art style, `pairedStyle` set, `leafIcon: false`. Specs transcribed verbatim from SKILL lines 211–219 / 92–99:
`cinematic_lower_third` (cinematic_realism), `watercolor_ribbon` (watercolor), `storybook_page` (storybook_illustration), `parchment_scroll` (animated_3d), `plasticine_banner` (claymation), `paperclip_note` (pencil_sketch), `pixel_sign` (pixel_art), `voxel_sign` (voxel_minecraft).

**Memorial (5), `group: 'memorial'`** — `pairedStyle: undefined`, `leafIcon: true`. Specs verbatim from SKILL lines 226–231:
`engraved_stone_plaque`, `polaroid_border`, `postcard_back`, `embroidered_sampler`, `pressed_flower_bookmark`.

Helper export: `containerForStyle(style: ArtStyleId): ContainerId` — returns the style-paired container; used by `CaptionContainer.tsx` to pre-highlight the "Recommended for your style" default.

### 2.3 The 6 curator's picks — `curatorsPicks`

Each: `{ id, name, format, theme, style, tagline, container, imagePrompt? }`. **The skill YAML ships only 4.** ADD the two from the v1.3 changelog:
- `forever_in_stone`: `{ format:'send_off', theme:'beloved_places', style:'cinematic_realism', container:'engraved_stone_plaque' }`
- `quiet_remembrance`: `{ format:'letter', theme:'gentle_rain', style:'watercolor', container:'pressed_flower_bookmark' }` — NOTE: the skill names a theme "Eternal Garden" that does not exist in the library; map to `gentle_rain` (closest Quiet-Grief memorial theme) and add a code comment citing the discrepancy.

The 4 original picks get `container: containerForStyle(style)`. All 6 picks' `style` must be from the warm group (styles 1–6) — verify with a `console.assert` at module load.

### 2.4 Resolver / derivation function signatures — `src/lib/peternal-resolvers.ts`

```ts
// Pronoun & vocative resolution from pronounsAndVocatives table.
// Resolves [PRONOUN_SUBJECT], [PRONOUN_SUBJECT_CAP], [PRONOUN_OBJECT], [PRONOUN_POSSESSIVE],
// [PRONOUN_POSSESSIVE_CAP], [PRONOUN_REFLEXIVE], [VOCATIVE], [VOCATIVE_PLAIN],
// [VOCATIVE_GOOD], [VOCATIVE_DEAR], [VOCATIVE_BUDDY], [PET_NAME], [TRAIT_ADJ],
// [USER_INPUT], [USER_INPUT_LINE_1], [USER_INPUT_LINE_2].
export function resolveText(template: string, ctx: { gender: Gender; petName: string; traitAdj?: string; userInput?: string[] }): string;

// Convenience wrapper: resolve an archetype's template to its on-screen text.
export function resolveArchetype(a: Archetype, ctx): string;

// Curator's-pick reordering by relationship (skill Stage 3.1).
// Moves the relationship's curatorsPickPriority pick to index 0; rest keep library order.
export function orderCuratorsPicks(relationship: RelationshipId): { ordered: readonly CuratorPick[]; highlightedId: CuratorPickId | null };

// Relationship-driven silent defaults for the manual path (Stage 3.1 last paragraph).
export function defaultThemeCategoryFor(relationship: RelationshipId): ThemeCategoryId | null;
export function defaultStyleFor(relationship: RelationshipId): ArtStyleId | null;

// Caption-voice pairing matrix (SKILL lines 243–252). Returns a label + a tense hint.
export function captionVoiceFor(format: FormatId): { label: string; tenseHint: string };

// Music filtering for Stage 5.5.4 — tracks whose pairsWith includes the theme's category
// AND styleMatch includes the chosen style; always return >= 4 (pad with mood-nearest).
export function musicTracksFor(theme: ThemeId, style: ArtStyleId): MusicTrack[];
```

`orderCuratorsPicks` is genuine logic: read `relationships.find(r => r.id === relationship)?.curatorsPickPriority`, partition `curatorsPicks` into `[matched, ...rest]`. If `relationship === 'unspecified'` or no match, return library order with `highlightedId: null`.

---

## 3. State management — `src/app/builder/state.ts`

### 3.1 Decision: React Context (not prop-drilling)

The full build has ~25 stage components, several gates that read state set 10 screens earlier, and cross-stage recomputation. **Use a single `BuilderContext`** exposing `{ state, update, patch, resetDownstream }`. One provider at `page.tsx`. Every stage calls `useBuilder()`. Stages still receive `{ onNext, onBack }` as props from the `Wizard` (navigation is the wizard's job). A `useState` object behind context — no reducer library, zero new deps.

### 3.2 `BuilderState` shape

```ts
export interface PetPhoto { id: string; name: string; file?: File; preview?: string; url?: string; }

export interface PetProfile {            // Stage 1.4 vision pass (simulated) + 1.5 edits
  species: string; speciesConfidence: 'high'|'medium'|'low';
  breedGuess: string; breedConfidence: 'high'|'medium'|'low';
  coatDescription: string; coatConfidence: 'high'|'medium'|'low';
  ageRange: 'puppy_kitten'|'young_adult'|'adult'|'senior'; ageConfidence: 'high'|'medium'|'low';
  bodyType?: 'tiny'|'small'|'medium'|'large'|'giant';
  observedSetting?: string; observedMoment?: string;
  visionFailed: boolean;                 // true => VisionConfirm degrades to explicit-question form
}

export interface Beat {
  index: number; archetype: BeatArchetype; name: string;
  visual: string;                        // visual description (derived)
  caption: string;                       // resolved caption (<=15 words)
  spokenOrTitle: string;                 // letter line / title text
  sceneHintSource?: string;              // which favoriteThing.id fed this beat
  lengthSeconds: 15;
}

export interface CinematographyBrief {   // Section 6 — one per beat
  beatIndex: number;
  lensMm: 24|35|50|85|105;
  lensCharacter: 'wide_establishing'|'standard'|'portrait'|'compression';
  cameraMove: CameraMove;                // 11-value union
  moveIntensity: 'barely_perceptible'|'gentle'|'pronounced';
  subjectMotion: 'locked'|'breath_only'|'loop_idle'|'loop_action'|'one_shot_action';
  lightingMotion: LightingMotion;        // 6-value union
  dofBehavior: DofBehavior;              // 5-value union
  shotStructure: 'single_sustained'|'two_shot_cut'|'three_shot_montage';
  ambientAudio: AmbientAudio;            // 7-value union
  audioIntensity: 'bed_only'|'present'|'forward';
}

export interface WordsState {
  opening: string;                       // archetype id OR 'custom'
  openingCustom: [string, string];
  closing: string;
  closingCustom: string;
  captions: { beatIndex: number; text: string }[];  // max 3
  music: string;                         // track id
  narration: 'off' | string;             // 'off' or narration_voice id
  narrationLetter: string[];             // 6 answers when narration on
  reviewed: boolean;
}

export interface BuilderState {
  returningUser: boolean | null;                              // 1.1
  petPhotos: PetPhoto[];                                      // 1.2
  petName: string; petNamePronunciation: string; gender: Gender | null;  // 1.3 / 1.7
  petProfile: PetProfile | null;                              // 1.4 / 1.5
  memoryPromptType: string | null; memoryPromptAnswer: string; // 1.6
  relationship: RelationshipId | null;                        // 1.8
  traits: string[]; favorites: string[];                      // 1.9 / 1.10 (2-3 each)
  creatorName: string; years: string; yearsIncluded: boolean; // 1.11 / 1.12
  characterSheetApproved: boolean; characterSheetRefinements: string[];  // 2 [GATE 1]
  beatCount: 8 | 12 | 16; targetMinutes: 2 | 3 | 4; aspectRatio: AspectId; // 2.5 / 2.6
  pickType: 'curated' | 'custom' | null; curatorsPick: CuratorPickId | null; // 3
  format: FormatId | null; themeCategory: ThemeCategoryId | null;
  theme: ThemeId | null; style: ArtStyleId | null;
  beatSheet: Beat[]; beatSheetApproved: boolean;              // 4
  captionContainer: ContainerId | null;                       // 4.5
  storyboardApproved: boolean; storyboardRerollRequests: number[];  // 5 [GATE 2]
  words: WordsState;                                          // 5.5
  cardText: { opening: string; closing: string };             // 5.6
  cardPreviewApproved: boolean; typographyLocked: ContainerId | null;
  dpStyle: DpStyleId; cinematographyBriefs: CinematographyBrief[];  // 5.7 [GATE 3]
  engineAdjustments: string[]; cinematographyApproved: boolean;
  generationComplete: boolean;                                // 6 / 7
  eulogyRequested: boolean;                                   // 8
}
```

`initialState` defaults: `beatCount: 12`, `targetMinutes: 3`, `aspectRatio: '9:16'`, `dpStyle: 'none'`, `gender: null`, `words` = `{ opening:'simple', closing:'gratitude_simple_farewell', captions:[], music:'silence', narration:'off', narrationLetter:[], reviewed:false }`, all booleans `false`, all arrays `[]`.

### 3.3 `resetDownstream` — cross-stage invalidation

`resetDownstream(fromStage: StepId)`:
- Change `length`/`beatCount` → clear `beatSheet`, `beatSheetApproved`, `storyboardApproved`, `cinematographyBriefs`, `cinematographyApproved`.
- Change `format`/`theme`/`style` → clear `beatSheet`+downstream AND reset `captionContainer` to `null`.
- Change `style` only → also clear `cardPreviewApproved`, `typographyLocked`.
- Change anything in `beatSheet` → clear `storyboardApproved`, `cinematographyBriefs`, `cinematographyApproved`.

One explicit function with a `switch`.

---

## 4. Wizard shell

### 4.1 `steps.ts` — step registry + groups + gates

```ts
export type StepId = 'welcome'|'returning'|'photos'|'name_gender'|'vision'|'memory_rel'
  |'traits_fav'|'creator_years'|'character'|'length_aspect'|'curators'|'style_confirm'
  |'format'|'theme'|'style'|'combo_preview'|'beatsheet'|'caption_container'|'storyboard'
  |'words'|'card_preview'|'cinematography'|'generate'|'finished';

export interface StepDef {
  id: StepId;
  group: 'intake'|'likeness'|'direction'|'story'|'words'|'finish';
  gate?: 1|2|3;             // marks GATE 1/2/3 on the rail
  skillStage: string;       // e.g. "1.2" — code comments/tests only
}

export const STEP_GROUPS = [
  { id:'intake',    label:'Tell us about them' },
  { id:'likeness',  label:'Their likeness' },
  { id:'direction', label:'The direction' },
  { id:'story',     label:'The story' },
  { id:'words',     label:'The words' },
  { id:'finish',    label:'The tribute' },
] as const;

export const STEPS: StepDef[] = [ /* 24 entries in pipeline order; character→gate:1, storyboard→gate:2, cinematography→gate:3 */ ];
```

`ReturningUser` ("yes") pre-fills defaults but the wizard still walks every step. No separate branch graph.

### 4.2 `Wizard.tsx`

Owns `const [stepIndex, setStepIndex] = useState(0)`. `next()` = `min(last, +1)`, `back()` = `max(0, -1)`, plus `goToStep(id)` for gates that bounce the user back. Renders the active stage by `STEPS[stepIndex].id` in a `switch`. Passes `{ onNext, onBack, goToStep }`. On backward jumps crossing a changed decision, call `resetDownstream`. Gate stages do NOT advance on `onNext` until their `*Approved` flag is true — the gate component owns its approval pills.

### 4.3 `ProgressRail.tsx`

Replaces `ProgressDots`. Renders the 6 `STEP_GROUPS` as labeled segments. Active group expanded (label + thin fill bar); completed groups show a filled brass dot; future groups muted. **The 3 gates are marked visibly**: a small `Lock`/`ShieldCheck` (lucide) glyph on the `likeness`, `story`, `words` segments at the gate step, in `PALETTE.brassDeep`, tooltip "Approval step". Gate glyph turns checked once its `*Approved` flag flips. Clicking a completed group jumps to its first step (guard: only `<= furthest reached`). Inline-styled, hosted in `TopBar`.

### 4.4 Where the SVG art lives

All 5 existing art components move verbatim into `src/app/builder/art/` with a barrel `index.ts`. New `CardArt.tsx` → CardPreview only. No art component imports state — pure presentational.

---

## 5. Per-stage component contracts

All stage components: default-export `({ onNext, onBack, goToStep }: StageProps)`, call `const { state, update } = useBuilder()`, wrap content in `<StageShell>` (or `<GateReview>` for gates).

| File | Skill | Renders | Key interactions / gate behavior |
|---|---|---|---|
| `Welcome.tsx` | 1.0 | Locked anti-trauma copy verbatim (4 lines), brass left-rule, "I'm ready" button. No emoji. | `onNext`. No data. |
| `ReturningUser.tsx` | 1.1 | Two pills: "No, this is my first" / "Yes, I've done this before". | Sets `returningUser`. "Yes" pre-fills neutral defaults but still advances to `photos`. |
| `Photos.tsx` | 1.2 | Pattern A: click/drag dropzone (`accept="image/*,.heic,.heif"`, multiple), divider, URL paste field + Add, photo grid with real `<img>` previews + remove. One-photo gentle follow-up line. | `addFiles`/`addUrl`/`remove` as current `PhotoUpload`. `canNext = petPhotos.length > 0`. Object-URL cleanup on remove. |
| `NameGender.tsx` | 1.3 + 1.7 | `FieldGroup` "Name" (large italic serif input). Pronunciation `FieldGroup` shown ONLY if `needsPronunciation(petName)` heuristic true. Gender: 3 pills with sublabels. | `canNext = petName.trim() && gender`. Gender required. |
| `VisionConfirm.tsx` | 1.4 + 1.5 | Simulated vision pass: on mount, 1.5s spinner, then populate `petProfile` via `buildSimulatedProfile(petPhotos, petName)` (deterministic, never random). Locked "Here's what I see in your photos of [PET_NAME]:" card + observation paragraph + 4 `EditChip`s (species, breed, coat, age). "Yes, that's [name]" / "Let me fix something". | Editing a chip patches `petProfile`. If `visionFailed`, render explicit-question form. `canNext` true after pass. |
| `MemoryRelationship.tsx` | 1.6 + 1.8 | Section 1: memory prompt — 3 prompt pills + "Skip", picking one reveals free-text. Section 2: relationship — 7 pills. | Sets `memoryPromptType`/`memoryPromptAnswer`/`relationship`. Both skippable. Store `relationship` even if 'unspecified'. |
| `TraitsFavorites.tsx` | 1.9 + 1.10 | Two multi-select pill groups: `personalityTraits` (cap 3), `favoriteThings` (cap 3). Counter hints. | Caps enforced. Gentle hint at 0 selected, no hard block. |
| `CreatorYears.tsx` | 1.11 + 1.12 | Creator name free-text (optional). Years: 3 pills ("I'll provide them" reveals input / "rather not" / "skip"). | Sets `creatorName`, `years`, `yearsIncluded`. All optional. |
| `CharacterSheet.tsx` | 2 — **GATE 1** | 2×2 grid of 4 views, `generating` spinner 2.4s then `PetSketch` placeholders. "What we observed" card. `GateReview` pills: "Yes, that's them" / "Close, but something's off" (refine multi-select: ears/eyes/face/fur/proportions/expression/other) / "Try again" / "Add more photos". Corrections textarea. | `onNext` ONLY on "Yes, that's them" → `characterSheetApproved=true`. Unlimited re-rolls, no cost language. |
| `LengthAspect.tsx` | 2.5 + 2.6 | Length: 3 cards (emotional labels primary, minutes secondary), "full tribute" recommended. Aspect: 4 cards incl. "All three formats". | Sets `beatCount`+`targetMinutes` together, `aspectRatio`. Changing after beatsheet exists → `resetDownstream`. |
| `CuratorsPicks.tsx` | 3.1 | 2-way `PathCard` choice (Curator's Picks / Build myself). Curated: 6 cards via `orderCuratorsPicks(relationship)` — highlighted pick first with subtitle "Based on what [PET_NAME] was to you", `StyleSwatch` hero, format/theme/style tags. | Pick → `pickType='curated'`, `curatorsPick`, `format`/`theme`/`style`; `onNext`→`style_confirm`. "Build myself" → `pickType='custom'`, apply `defaultThemeCategoryFor`/`defaultStyleFor` silently; `onNext`→`format`. |
| `StyleConfirm.tsx` | 3.1.5 | Runs ONLY if `pickType==='curated'`. Pattern B: "This pick uses **[STYLE]** — keep it, or switch?" — "Keep [style]" pill first, then other 7 styles (suppress duplicate; always 8 pills). | Switching mutates only `style`. `onNext`→`combo_preview`. |
| `FormatPick.tsx` | 3.2 | Manual path only. 8 format cards with `FormatThumb`, icon, name, desc. | Sets `format`. `onNext`→`theme`. |
| `ThemePick.tsx` | 3.3 | Internal sub-step: (0) 6 category `ChoiceCard`s with emoji; (1) 2 theme cards (gradient hero) + back. | Sets `themeCategory` then `theme`. `onBack` from sub-step 0 → `format`. |
| `StylePick.tsx` | 3.4 | Manual path only. 8 style cards in two rows ("Warm and traditional" 6 / "Playful and stylized" 2) with a divider. `StyleSwatch` previews. Pixel/Voxel carry opt-in framing. | Sets `style`. `onNext`→`combo_preview`. |
| `CombinationPreview.tsx` | 3.5 | One simulated preview frame: `BeatScene`-style art tinted to `theme.gradient`+`style`. Caption "Here's [name] in [format] + [theme] + [style]." Pills: "Yes, this is it" / "Try a different style/theme/format" / "Start over". | "Yes"→`onNext` to `beatsheet`. Others `goToStep` back. |
| `BeatSheet.tsx` | 4 | On mount, if `beatSheet` empty, call `generateBeatSheet(state)` and `update`. Render beats as table/card list. Pills: "Looks good" / "Change a beat" / "Re-order" / "Drop" / "Add". | Genuine generation. Edits mutate `beatSheet` + `resetDownstream('beatsheet')`. `onNext` on "Looks good" sets `beatSheetApproved`. |
| `CaptionContainer.tsx` | 4.5 | 13 container cards in 2 groups ("Style-paired (8)" / "Memorial (5)") with divider. `containerForStyle(style)` pre-highlighted with "Recommended for your style" badge (pre-selected). Memorial containers show a leaf icon. | Sets `captionContainer`. `onNext` advances. No cost framing. |
| `Storyboard.tsx` | 5 — **GATE 2** | One `BeatScene` frame per beat, in `aspectRatio`. Batch spinner then frames. `GateReview` pills: "All good — move to The Words" / "Re-render a frame" / "Re-render multiple". Textarea. | `onNext` on "All good" → `storyboardApproved=true`. Re-render adds to `storyboardRerollRequests` and re-spins. |
| `TheWords.tsx` | 5.5 | Internal 6 sub-steps: 5.5.1 opening (archetype grid grouped by register, pills show `resolveArchetype` text), 5.5.2 closing, 5.5.3 captions (≤3 beats, suggestions from `captionTemplates` resolved by gender, cap-4 kind message), 5.5.4 music (`musicTracksFor` 4 cards + `Waveform`), 5.5.5 narration (off default; "on"→6-question letter), 5.5.6 review summary. | Every sub-step skippable; defaults from `default_words`. Review "Yes"→`onNext` to `card_preview`, sets `words.reviewed`. |
| `CardPreview.tsx` | 5.6 | 3 simulated cards via `CardArt` (opening title / closing / one in-scene caption), using `captionContainer` typography spec + `cardText`, in `aspectRatio`. Lead copy "Here's how the title cards and a sample caption look in [name]'s world." `GateReview` pills: "Looks great — onward" / "Change the wording" (→`words`) / "Re-render" / "Switch art style" (→`style`/`style_confirm`). | "Looks great" sets `cardText` final + `typographyLocked` + `cardPreviewApproved`; `onNext`→`cinematography`. |
| `Cinematography.tsx` | 5.7 — **GATE 3** | On mount, if `cinematographyBriefs` empty: run `runCinematographyEngine(state)` → set `cinematographyBriefs`+`engineAdjustments`. DP-style picker (6 options, `none` default) — changing re-runs the engine. N-row brief table (#, Beat, Lens, Move, Intensity, Subject, Lighting, DOF, Shot, Audio). `engineAdjustments` log below. `GateReview` pills: "Approve and start generation" / "Adjust a scene" (per-field pickers) / "Apply a different DP style" / "Regenerate". | Per-scene edits mutate one brief. "Approve" sets `cinematographyApproved`; `onNext`→`generate`. |
| `Generate.tsx` | 6 | Reuses current `FinalTribute` loop: progress bar "Beat X of N", per-beat tiles flipping from spinner to `BeatScene`. No mid-stage gate. | Asserts all briefs present. On `progress===beatCount` sets `generationComplete`; `onNext`→`finished`. |
| `FinishedTribute.tsx` | 7 + 8 | Final tribute "video" card in `aspectRatio` with play/pause, `cardText.closing` overlay, optional years. Download / memorial-page / family-channel buttons (no-op). Eulogy PDF offer card → "Yes" sets `eulogyRequested`, shows composed eulogy preview via `composeEulogy(state)`. "Start a tribute for another pet" resets. | Terminal screen. |

**`GateReview` + `ApprovalPills` primitives (NEW in `lib/primitives.tsx`).** `GateReview` = a `StageShell` variant whose footer is a column of large approval pills + a corrections `<textarea>`. `ApprovalPills` = the pill row, `{ options: {id,label,tone?}[], onSelect }`. Tone `primary` for the approve action. Backs all 3 gates + minor approvals.

---

## 6. Cinematography Engine + Beat Sheet — pure TS

### 6.0 Beat Sheet generator — `src/lib/peternal-beatsheet.ts`

```ts
export function generateBeatSheet(input: {
  beatCount: 8|12|16; format: FormatId; theme: ThemeId; gender: Gender;
  petName: string; favorites: string[]; memoryPromptAnswer: string; traits: string[];
}): Beat[];
```

Deterministic logic:
1. Read arc template `beatStructures[beatCount]` (`BeatArchetype[]` length 8/12/16 — transcribed from SKILL lines 827–851).
2. For each `memory` slot, pull the next unused `favoriteThings.find(f => id===favorites[k]).sceneHint`; one memory slot uses `memoryPromptAnswer` if present; fall back to a generic memory beat if favorites run out.
3. `connection` → "familiar gaze / paw-on-hand" visuals. `ceremonial` → theme-arc visuals keyed to `themes.find(theme).description` (threshold → first step → crossing → archway). `release` → joyful-release. `open`/`close` → title-card beats.
4. Apply format overrides (SKILL lines 854–860): Music Video → verse/chorus naming; Biopic → chronological memory naming; Letter → `spokenOrTitle` carries a letter line; Postcards → each beat a location; Greatest Hits → no ceremonial section.
5. Caption per beat: pick from `captionTemplates` keyed to sub-archetype, `resolveText` with gender. Enforce ≤15 words, `petName` ≤1× across the sheet, beat 1 caption = opening line, last = closing line.
6. NO motion data on beats.

Pure, no React, no `Math.random`. Same input → same beats.

### 6.1 Engine schema — `cinematographyEngine` in the library

Typed object: Part-2 derivation table (10 fields, allowed values + inputs), Part-3 constraint parameters (per-format lens ranges `{day_in_the_life:[35,85], send_off:[50,85], music_video:[35,50,85], letter:[50,85], postcards:[24,50]}`, max-3-consecutive-move, calm-bookend, caption-readable threshold `wordCount>=12`, ambient ≤3 families), and `dpStyleLibrary`.

### 6.2 The engine — `src/lib/peternal-cinematography.ts`

```ts
// Part 1: per-frame vision pass (SIMULATED — deterministic stub from beat archetype + theme + sceneHint keywords)
export interface FrameMetadata {
  subjectEnergy: 'still'|'low'|'medium'|'high';
  subjectPose: 'lying'|'sitting'|'standing'|'walking'|'running'|'mid_leap'|'closed_eyes';
  framing: 'extreme_close'|'close'|'medium'|'wide'|'extreme_wide';
  environmentalMotion: 'still'|'wind'|'water'|'particles'|'sky'|'dappled_light';
  depthLayers: 1|2|3;
  dominantPaletteTemperature: 'warm'|'neutral'|'cool';
}
export function simulateFrameMetadata(beat: Beat, theme: ThemeId): FrameMetadata;

// Part 2: per-beat brief derivation (pure rules)
export function deriveBrief(frame: FrameMetadata, beat: Beat, ctx: { positionInArc: number; totalBeats: number; format: FormatId; theme: ThemeId; style: ArtStyleId }): CinematographyBrief;

// Part 3: whole-tribute consistency pass
export function consistencyPass(briefs: CinematographyBrief[], format: FormatId, beats: Beat[]): { briefs: CinematographyBrief[]; adjustments: string[] };

// Part 4: optional DP-style overlay
export function applyDpStyle(briefs: CinematographyBrief[], dp: DpStyleId): CinematographyBrief[];

// Orchestrator
export function runCinematographyEngine(state: BuilderState): { briefs: CinematographyBrief[]; adjustments: string[] };
```

`runCinematographyEngine` order (skill 5.7.1→5.7.4): `simulateFrameMetadata` per beat → `deriveBrief` per beat → `applyDpStyle` (if `dpStyle !== 'none'`) → `consistencyPass`. DP overlay applies *before* consistency pass so constraints still win.

**Part 2 is real branching logic.** Examples:
- `lensMm`: `framing` → base lens (`extreme_close|close → 85`, `medium → 50`, `wide → 35`, `extreme_wide → 24`); ceremonial beats nudge +1 step toward 85/105. `lensCharacter` derived from `lensMm`.
- `cameraMove`: `subjectEnergy × archetype`, variety check against prior beat's move (engine carries `prevMove`).
- `moveIntensity`: `caption.split(/\s+/).length >= 12 → barely_perceptible`; else `subjectEnergy` mapped.
- `shotStructure`: `single_sustained` default; `two/three_shot` only when `subjectEnergy==='high'` && format non-ceremonial.

**Part 3 enforces all 5 constraints in order**, each pushing a human-readable string into `adjustments` (e.g. `"Scene 8 lens changed from 105mm to 85mm to stay in tribute lens range."`). Lens-range: if >2 distinct lenses, reassign out-of-range to nearest in-range with same `lensCharacter`. Move-variety: scan windows of 3; if all equal, re-derive the 3rd. Calm bookends: force beat 0 and last to `moveIntensity<=gentle` + `single_sustained`. Caption-readable: `captionWordCount>=12 → barely_perceptible`. Ambient: collapse to ≤3 sound families.

**Part 4** — bias each field toward the DP's preferences without violating allowed-value sets.

All functions pure and deterministic — same `state` → same briefs.

### 6.4 `dpStyleLibrary` (6 entries)

`{ id, name, bias }` transcribed verbatim from SKILL lines 60–66: `none`, `deakins_minimalist`, `lubezki_natural`, `young_intimate`, `khondji_painterly`, `wong_kar_wai_dreamy`. `bias` is a partial-weight object `applyDpStyle` reads.

---

## 7. Build sequence — parallelizable waves

**WAVE 0 — scaffolding.** Create `src/app/builder/{lib,art,shell,stages}/` dirs + barrels; move `PALETTE` → `lib/palette.ts`; move the 5 art components verbatim → `art/*.tsx`; extract primitives verbatim → `lib/primitives.tsx`; create `state.ts` (Section 3) + `steps.ts` (Section 4.1); create STUB stage components so the shell compiles.

**WAVE 1 — pure library + logic (parallel, no React).**
- A: `src/lib/peternal-library.ts` — all data + types (Section 2).
- B: `src/lib/peternal-resolvers.ts` (Section 2.4) + `src/lib/peternal-beatsheet.ts` (Section 6.0).
- C: `src/lib/peternal-cinematography.ts` (Section 6.2).

**WAVE 2 — shell.** `shell/Wizard.tsx`, `shell/ProgressRail.tsx`, `shell/TopBar.tsx`, rewrite `page.tsx`. Add `GateReview`+`ApprovalPills`+`EditChip` to `lib/primitives.tsx`.

**WAVE 3 — stages (parallel, one file each).** Stage files never import each other.
- Coder 1 (intake): `Welcome`, `ReturningUser`, `Photos`, `NameGender`.
- Coder 2 (intake): `VisionConfirm`, `MemoryRelationship`, `TraitsFavorites`, `CreatorYears`.
- Coder 3 (likeness+length): `CharacterSheet`, `LengthAspect`.
- Coder 4 (direction): `CuratorsPicks`, `StyleConfirm`, `FormatPick`, `ThemePick`, `StylePick`, `CombinationPreview`.
- Coder 5 (story): `BeatSheet`, `CaptionContainer`, `Storyboard`, `CardPreview` (+ `art/CardArt.tsx`).
- Coder 6 (words+finish): `TheWords`, `Cinematography`, `Generate`, `FinishedTribute`.

**WAVE 4 — integration.** Wire `resetDownstream` into `Wizard`; verify gates block; remove `@ts-nocheck`; fix type errors; `next build` + click-through of all 24 steps for all 3 lengths.

**WAVE 5 — verification.** Code review + lint/build check.

---

## 8. Design-system guidance

- Reuse `PALETTE` and every existing primitive. New screens compose `StageShell`/`FieldGroup`/`Pill`/`ChoiceCard`/`PathCard`/`Serif`/`Sans`/`Eyebrow`/`PrimaryButton` exactly as the current 8 screens do. Do not redesign — extend.
- Inline styles only. No Tailwind classes in builder files.
- Fonts come free from `layout.tsx` (`Cormorant_Garamond` + `Inter`). The `Serif`/`Sans` primitives hardcode the family strings — keep that.
- Gentle UX tone is a HARD rule. No "credits", no "are you sure", no "last chance". Gate re-rolls framed as care. Skipped stages never read as failure.
- New screens that render generated content (BeatSheet table, Cinematography brief table, CardPreview cards) stay visually quiet — `boneSoft` panels, `parchmentLight` borders, serif headings.
- The `ProgressRail` is the progress indicator — drop the per-stage "X of Y" counters in favor of it.

---

## 9. What NOT to change

- Do not touch `src/lib/peterna-tokens.ts`, `layout.tsx`, `globals.css`, or any marketing route.
- Do not merge `PALETTE` into `C`.
- Do not rewrite the 5 SVG art components — move them verbatim.
- Do not add a backend, API route, or real image/video generation.
- Do not introduce a state library, a router library, or test runners into prod deps.
- Do not change the locked Welcome copy or the locked "Here's what I see" card copy — transcribe verbatim from the skill.
- Do not use `Math.random` in the engine or beat-sheet — variety is rule-driven (prior-beat comparison), not random.
