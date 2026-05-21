# Phase plan — build sequence, DoD, agent dispatch

**Owner / agent type:** PM / scrum.
**Prerequisites:** read `architecture.md` §7 first.

## Sequencing principle

Ship Phase 1 to a hand-off shape first, then 2, then 3. Don't try to land 1+2+3 in one PR. Stage 2 (character sheet) is the spec's named "single failure mode" and deserves its own QA cycle with Xee on real pet photos before any Stage 3 code lands.

## Phase 0 — Foundation (one PR, 1 day)

**Scope:** scaffolding only, no UI, no vendor calls.
**Dispatch:** backend agent solo.
- Add Postgres connection + Drizzle config (local Postgres for dev; prod host TBD); create the three tables from `data-model.md`.
- Add S3 client wrapper at `src/lib/storage/s3.ts`.
- Add the vendor layer scaffolding at `src/lib/ai/` per `vendor-layer.md` — capability functions exist, vendor modules are stubbed with `throw new Error('not implemented')`.
- Add `SESSION_SECRET` HMAC helper.
- Library skeleton at `src/lib/library/` with empty stubs and `index.ts` re-exports. Add the load-time validator that throws if minimum counts unmet.

**Definition of done:** `pnpm dev` boots, DB migration runs clean, `import { generateImage } from '@/lib/ai'` typechecks, library validator passes against the stubs (after seeding minimum-count fixtures).

## Phase 1 — Intake (Stage 1) [M]

**Scope:** welcome → photos → name → vision pass → confirmation card → memory → gender → relationship → traits → favorites → creator → years. No image renders.

**Routes added:** `session/create`, `session/[id]` (GET/PATCH/DELETE), `upload`, `ingest-url`, `vision-pass`.

**Vendor layer used:** `runVisionPass()` only.

**Components added:** `WizardShell`, `StageBanner`, `WelcomePanel`, `PhotoUrlField`, `PillPicker`, `TextField`, `ConfirmationCard`.

**Library populated:** `copy.ts` (full Stage 1 verbatim), `pronouns.ts`, `relationships.ts`, `intake.ts` (`memory_prompts`, `personality_traits`, `favorite_things`), `vision-pass.ts` (prompt + schema), `defaults.ts`.

**Env vars wired:** `DATABASE_URL`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `FAL_KEY`, `SESSION_SECRET`.

**Dispatch order:**
1. Backend agent — Phase 0 + `session/*` routes + `upload` + `ingest-url`. Wire OpenAI + Gemini in `runVisionPass`.
2. Frontend agent — `WizardShell`, welcome panel, `PhotoUrlField`, intake `PillPicker`s. Reads existing `peterna-tokens.ts`.
3. Backend + Frontend in parallel — `/api/vision-pass` route + `ConfirmationCard` consuming its output.
4. QA agent — see DoD below.

**Definition of done (E2E):**
- User loads `/builder`, gets a session created, walks through every Stage 1 screen.
- Uploading 3 photos via dropzone + 1 Google Drive link results in 4 assets in S3 + 4 rows in `assets`.
- `/api/vision-pass` returns a realistic `inferred_profile` for a known test photo (Xee's dog).
- `ConfirmationCard` renders the observation paragraph; tapping a chip lets the user edit; "Yes, that's [pet]" saves and advances stage to `intake_memory`.
- User completes the rest of Stage 1, gets `intake_complete` state in DB.
- Reload page restores state; resume link at `/builder/r/<token>` works.
- `DELETE /api/session/[id]` cascades to S3 + DB.

## Phase 2 — Character Sheet (Stage 2) [M]

**Scope:** 4-view 2K character sheet render, approval gate, refinement loop (multi-select corrections + free-text), unlimited re-rolls, lock + transition. Then length (2.5) + aspect (2.6) pickers.

**Routes added:** `character-sheet/render`, `character-sheet/approve`.

**Vendor layer used:** `generateImage()` for the first time. **Validate OpenAI primary path and fal fallback both work** (force fallback with `AI_VENDOR_OVERRIDE=fal` env override, see `vendor-layer.md`).

**Components added:** `GateReview`, `CharacterSheetView` (a `GateReview` body slot renderer that shows the 4-view sheet at responsive size with the refinement chip group below).

**Library populated:** `art-styles.ts` (only the directives needed for character-sheet prompt; full directives for downstream phases).

**Dispatch order:**
1. Backend agent — `generate-image.ts` direct OpenAI implementation + fal fallback + `character-sheet/render` route + prompt builder. Re-hosts vendor output to S3.
2. Frontend agent — `GateReview`, `CharacterSheetView`, length picker, aspect picker.
3. QA agent — DoD + manual review against the spec's "wrong-looking pet" cases.

**Definition of done (E2E):**
- User completes intake, lands on `character_sheet_render`, sees the 4-view sheet rendered in 30–45s.
- "Close, but something's off" → refinement chips + textarea → re-render appends corrections to the prompt; the new render reflects them.
- Unlimited re-rolls work; `Idempotency-Key` dedupes double-taps within 60s.
- Force `AI_VENDOR_OVERRIDE=fal` and confirm the same flow works end-to-end via fal.
- Approval advances to `length_pick`, then `aspect_pick`, then `curators_pick_or_manual`.

## Phase 3 — Format/Theme/Style (Stage 3) [L]

**Scope:** Curator's Picks (relationship-ordered), 3.1.5 style confirm (curator path only), manual path (format → category → theme → style), combination preview, approval.

**Routes added:** `preview/render`, `preview/approve`.

**Vendor layer used:** `generateImage()` (combination preview).

**Components added:** `CuratorPickGrid`, `FormatGrid`, `ThemeCategoryGrid`, `ThemeGrid`, `StyleGrid` (all are specialized `PillPicker` variants — same primitive, different `pills`/`variant`), `CombinationPreviewReview` (a `GateReview` variant).

**Library populated:** `formats.ts`, `themes.ts`, `art-styles.ts` (full directives), `curators-picks.ts`. Relationship-driven defaults wired (curator-pick reorder, theme/style biases for manual path).

**Dispatch order:**
1. Backend agent — `preview/render` route + prompt builder. Validate spec's likeness-reference rule appears verbatim in the prompt.
2. Frontend agent — all five grid components + the route through curator's-pick → 3.1.5 → 3.5 versus manual → 3.2 → 3.3 (category then theme) → 3.4 → 3.5.
3. QA agent — DoD.

**Definition of done (E2E):**
- Curator's path: user picks "The Quiet Goodbye" → sees 3.1.5 style confirm with Watercolor pre-named → can keep or switch style → preview renders with their pet → approval locks `combination_preview_asset_id`.
- Manual path: user picks "Let me choose myself" → format → category → theme → style → preview → approval.
- Relationship-driven reorder works: a `companion_through_grief` user sees "The Quiet Goodbye" at position #1 with the "Based on what [pet] was to you" subtitle.
- "Try a different style" returns to 3.4 and re-renders preview after re-pick.

## Deferred (not in scope)

| Phase | Scope | Why deferred |
|---|---|---|
| 4 | Beat sheet (Stage 4) + Storyboard (Stage 5) | Storyboard alone is N image renders; bigger surface than Stage 3 |
| 5 | The Words (5.5) + Card preview (5.6) | New typography pipeline; music UX |
| 6 | Cinematography Engine (5.7) | Stage 5.7 is its own subsystem with vision-pass-per-frame + a consistency-pass solver |
| 7 | Seedance video gen + assembly | First Phase that touches `generateVideo()`. fal.ai is sole vendor (no direct ByteDance API); accept single-vendor risk per Risk Register #4. |
| 8 | Eulogy PDF | Spec's final stage; PDF rendering is the only new technology |
| 9 | **Final Delivery (added beyond the spec)** | Single-page customer-facing delivery: assembled MP4 + eulogy PDF + all artifacts (character sheet, storyboard, opening/closing cards) on one shareable URL. Download links + optional email-out. The spec ends at Stage 8 because it's a chat-skill (deliverables surface inline); a web app needs an explicit "here's your tribute" moment. |

## Cross-phase QA checklist

- Vendor fallback path exercised at every render-introducing phase.
- Cost telemetry (`renders.cost_usd_est`) populated and dashboard-queryable.
- No vendor names, model names, or technical jargon in any user-facing copy.
- `DELETE /api/session/[id]` cascades cleanly at every phase.
