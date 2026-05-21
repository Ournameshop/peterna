# UI components — wizard architecture (Stages 1–3)

**Owner / agent type:** Frontend.
**Prerequisites:** read `architecture.md` §6 and `copy-and-content.md` first.

## Conventions (locked)

- **Inline `style={{}}` + tokens from `src/lib/peterna-tokens.ts`.** No Tailwind for layout. No UI library. This matches the existing convention (~128 inline-style usages on `page.tsx`). If a component needs a new token, add it to `peterna-tokens.ts` first.
- **No CSS modules, no styled-components.** Hover/focus states use `onMouseEnter`/`onFocus` setting a local style override, or `aria-*` selectors via a single `<style>` tag at the page root when truly necessary.
- **No client-side state libraries.** `useReducer` for the wizard state machine. `useFormStatus` and Server Actions for form submission.
- **All builder pages render at `/builder`.** State lives in `?step=...&session=...` query params, not in file-system routes per step. Reasons in `architecture.md` §6.

## Five widget patterns → five React primitives

Under `src/components/builder/`:

| Pattern | Component | Use cases |
|---|---|---|
| A — Photo + URL combo | `PhotoUrlField.tsx` | Stage 1.2 photo upload (file dropzone + URL textarea coexisting) |
| B — Pill picker (single or multi-select) | `PillPicker.tsx` | Stage 1.7 gender, 1.8 relationship, 1.9 traits, 1.10 favorites, 2.5 length, 2.6 aspect, 3.1 curator's pick, 3.1.5 style confirm, 3.2 format, 3.3 category/theme, 3.4 style, 3.5 preview approval |
| C — File-only upload | `AudioUpload.tsx` | Phase 5 (music). Stubbed in Phase 1 — don't build. |
| D — Free-text input | `TextField.tsx` | 1.3 pet name, 1.3 pronunciation, 1.6 memory free-text follow-up, 1.11 creator name, 1.12 years free-text, 2.3 refinement notes |
| E — Gate review (read-only + approval pills) | `GateReview.tsx` | Stage 2 character sheet approval, 3.5 combination preview approval |

Plus three composite/shell components:

- `WizardShell.tsx` — header (stage banner + progress dots) + body slot + footer with the "If the form sticks, just type your answer" fallback line. Mandatory on every screen.
- `ConfirmationCard.tsx` — Stage 1.5 "Here's what I see": observation paragraph + tappable field chips. Each chip opens an inline edit (single-select for species/age, free-text for breed/coat). "Let me fix something" expands all chips into edit mode.
- `StageBanner.tsx` — emoji + headline per spec banner table. Single banner per stage entry.

### `PillPicker.tsx` shape

```ts
type Pill = {
  id: string;
  label: string;
  description?: string;       // secondary line for rich pills (formats/themes/styles)
  icon?: ReactNode;           // emoji or SVG for rich-pill variant
  badge?: string;             // "Recommended for your style", "(what your pick uses)"
};
type Props = {
  pills: Pill[];
  multi?: boolean;            // single-select default; multi for traits/favorites
  defaultSelected?: string[];
  variant?: 'plain' | 'rich'; // rich = icon + label + description card
  onSubmit: (selectedIds: string[]) => void;
  submitLabel?: string;       // default 'Continue'
  skipLabel?: string;         // optional Skip button
};
```

## Wizard state machine

`src/lib/builder/state.ts` exports a tagged union covering Stages 1–3:

```
intake_welcome
intake_returning_user_check
intake_photos
intake_name
intake_name_pronunciation        (conditional: heuristic-flagged name)
intake_vision_review             (= "Here's what I see" — skipped on vision_failure)
intake_memory
intake_gender
intake_relationship
intake_traits
intake_favorites
intake_creator
intake_years
intake_complete
character_sheet_render           (in-flight)
character_sheet_review           (GATE 1)
character_sheet_refinement       (sub-state: refinement multi-select + textarea)
length_pick
aspect_pick
curators_pick_or_manual
curator_style_confirm            (only after curator's pick)
format_pick
theme_category_pick
theme_pick
style_pick
combination_preview_render       (in-flight)
combination_preview_review       (GATE 2 for Phase 1)
stage_3_complete
```

The reducer enforces legal transitions. Same reducer is imported by `PATCH /api/session/[id]` to reject illegal skip-ahead — single source of truth.

URL drives state: `/builder?step=<state-tag>&session=<id>`. Page reload restores from `GET /api/session/[id]`. Back-button is restricted past approved gates via `pushState` (no `replaceState` after a gate).

## Routing

- `/builder` — main wizard. Reads `?session=...` from URL or creates a session via `POST /api/session/create` on first load and redirects with the new ID. (Server Action on entry.)
- `/builder/r/<resume_token>` — server-side resolves the resume token to a session ID and redirects to `/builder?session=<id>&step=<sessions.stage>`.

## Skill-spec pattern → component map

| Spec construct | Component |
|---|---|
| Stage 1.0 anti-trauma welcome panel | `WelcomePanel` (one-off; full-bleed centered, `FONT_DISPLAY`, copy from `library/copy.ts`) |
| Stage 1.2 photo dropzone + URL field | `PhotoUrlField` (Pattern A) |
| Stage 1.5 "Here's what I see" card | `ConfirmationCard` |
| Stage 2 character sheet 4-view + approval | `GateReview` wrapping `CharacterSheetView` |
| Stage 2.3 refinement multi-select + textarea | `PillPicker` (multi) + `TextField` (textarea) inside `GateReview` |
| Stage 3 curator's-pick grid | `CuratorPickGrid` (specialized `PillPicker` variant; rich-pill with subtitle support) |
| Stage 3.3 category screen (6 emoji buttons) → theme screen (2 themes + back) | Two sequential `PillPicker` screens; the "back" pill on screen 2 is a native pill with `id='__back__'` handled by the reducer |
| Stage 3.4 art-style row split (warm-and-traditional / playful-and-stylized) | `PillPicker` with a `divider?: number` prop indicating after which index to render a subtle horizontal divider |
| Stage 3.5 combination preview approval | `GateReview` |

## Don't build in Phase 1

`AudioUpload.tsx` (Phase 5), `BeatSheetTable.tsx` (Phase 4), `StoryboardGrid.tsx` (Phase 4), `CinematographyBriefTable.tsx` (Phase 6), `VideoReview.tsx` (Phase 7).
