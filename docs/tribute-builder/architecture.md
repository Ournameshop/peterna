# Tribute Builder — Implementation Architecture (Stages 1–3)

> Scope: translate Stages 1, 2, 3 of `SKILL (5).md` (Peternal v2.3) from a Claude-runtime skill into the Next.js 16 web app at `peterna`. Stages 4–8 are out-of-scope; this doc names what to stub vs. drop.
>
> **Read first:** `README.md` in this directory tells you which sub-doc to load based on your agent type. The mega-doc you're reading is the anchor; the per-concern docs (`vendor-layer.md`, `data-model.md`, `api-routes.md`, `ui-components.md`, `copy-and-content.md`, `phase-plan.md`, `risk-register.md`) are authoritative for their slice.

## TL;DR

- **Vendor strategy:** hybrid — direct vendor primary, fal.ai fallback per capability where a direct path exists. GPT Image 2 → OpenAI primary, fal fallback. Vision pass → OpenAI GPT-4o primary, Gemini 2.5 fallback. **Seedance 2.0 → fal.ai sole vendor** (no direct ByteDance/Volcengine API available from US as of 2026-05-21; single-vendor risk accepted, Phase 4+). TTS (out of Phase 1) → ElevenLabs direct, no fallback. Higgsfield is OUT.
- **Persistence:** Postgres + AWS S3 + anonymous sessions keyed by HMAC cookie and resumable link. Local Postgres for dev; production host deferred until deploy target is chosen. No accounts in Phase 1.
- **Phase 1 routes added:** 6 — `session/create`, `session/[id]` GET/PATCH/DELETE, `upload`, `ingest-url`, `vision-pass`.
- **Deferred:** Stages 4–8 (beat sheet, storyboard, words, card preview, cinematography engine, video gen, assembly, eulogy PDF), narration, music, DP overlay, caption containers / baked typography.
- **Biggest risk:** likeness drift at Stage 2 — the spec's "single failure mode that ruins the tribute" — paired with cost runaway from re-roll storms if we don't rate-limit and dedupe.

---

## 1. Vendor matrix (hybrid: primary + fallback)

**Decision: every model call routes through `src/lib/ai/`, a thin capability-typed abstraction. The hybrid layer tries the direct vendor first, falls back to fal.ai on transport or quota failures, and surfaces a structured `AIError` if both fail.** See `vendor-layer.md` for the full interface spec, error contract, and observability hooks.

| Capability | Primary (direct vendor) | Fallback | Phase | Notes |
|---|---|---|---|---|
| **Image gen** (character sheet, combination preview, storyboard frames, card preview) | **OpenAI GPT Image 2** — `POST /v1/images/generations` and `/v1/images/edits`. Native multi-image reference at high fidelity (model snapshot `gpt-image-2-2026-04-21`). | **fal.ai** `openai/gpt-image-2` | 1+ | Multi-image reference is non-negotiable for likeness — both routes support it. |
| **Vision pass** (Stage 1.4 — structured pet profile from photos) | **OpenAI GPT-4o** via `/v1/chat/completions` with `response_format: { type: 'json_schema' }`. Picked over Gemini 2.5 for tighter JSON-schema enforcement on a model we're already keying for image gen — one less API surface to operate. | **Google Gemini 2.5 Pro** (`generateContent` with `responseMimeType: 'application/json'` + `responseSchema`) | 1+ | Gemini's structured-output upgrade in 2026 supports `$ref`/`anyOf`; fully sufficient as fallback. If both fail, surface `vision_failure: true` and degrade to the v0.7 explicit-question flow per spec §1.4 fallback rule. |
| **Video gen** (Seedance 2.0, 15s clips, 1080p, audio ON) | **fal.ai** `bytedance/seedance-2.0/{image-to-video,reference-to-video,fast/...}` — sole vendor; no direct ByteDance/Volcengine API available from US as of 2026-05-21. | None | 4+ | Phase 1 does not invoke this. Single-vendor risk explicitly accepted per Risk Register #4. If a direct ByteDance/Volcengine API opens up before Phase 4, revisit and add as primary. |
| **TTS / narration** (Stage 5.5.5 — out of Phase 1) | **ElevenLabs** direct | None | 5+ | Flagged here so the vendor abstraction is built to take a third capability cleanly. No fal fallback for Phase 1 voice. |

**Why direct-primary, fal-fallback:** direct vendors usually have lower latency, better quotas, and clearer billing/observability. fal.ai is a competent generalist but it's a proxy — when OpenAI rate-limits fal's pooled account or ByteDance changes the upstream contract, we get hit silently. Direct gets us pricing transparency and SLA-level recourse; fal gets us survival when direct is degraded.

**Tradeoffs accepted:**
- (+) Lower happy-path latency and per-call cost on capabilities where a direct vendor exists; first-class SDK ergonomics with `openai` and `@google/generative-ai`.
- (−) Two code paths per capability to keep correct. Mitigated by the `vendor-layer.md` interface — call sites stay vendor-agnostic; the dual-implementation lives behind one function.
- (−) Two vendor accounts per capability to provision and rotate. Mitigated by the env-var convention in `vendor-layer.md` (all `*_API_KEY` env names follow `<VENDOR>_<CAPABILITY>_KEY`).

**Phase-1 cost per session estimate** (with direct primary): vision pass via OpenAI ~$0.005 · character sheet 1 + ~4 refinements × $0.40 ≈ $2.00 · combination preview 1–3 × $0.04 ≈ $0.10. **~$2 per session pre-video.** Fal fallback is within 15% of these numbers.

**Why not Higgsfield (the spec's pick):** OUT entirely. The spec calls `Higgsfield:generate_image` via an internal Anthropic MCP tool, not a public HTTP API. Replicating from Node means a proxy with credit accounting against expiring packs, no SDK, no fall path.

---

## 2. Session-state model

**Pick: Postgres + S3 + anonymous sessions.** Cookie-token (HMAC signed, httponly) keys every request; an opt-in resume-token gives a shareable `/builder/r/<token>` link.

- **Why not localStorage-only:** photo ingestion, vision pass, and character-sheet approval all need server-readable state across requests.
- **Why not auth (NextAuth/Clerk):** grieving users abandon signup. Add email magic-link in Phase 2 — zero schema change.
- **Why Postgres (not SQLite/Mongo/Supabase-bundled):** boring single-purpose relational DB. Local Postgres for dev (just run `postgres` via brew/Docker); production host deferred until deploy target is chosen. Drizzle ORM is host-agnostic — Neon, Supabase, RDS, a Postgres container on the EC2 fleet all work with the same schema and connection string.

Full schema sketch and lifecycle rules live in `data-model.md`. The short version: three tables — `sessions`, `assets`, `renders` — with a 30-day inactivity purge and a user-triggered "Delete my tribute" cascade.

The `renders` table now also captures `vendor_attempted` and `vendor_served` columns to attribute cost and observe fallback frequency (see `vendor-layer.md`).

---

## 3. Library / content data

**Pick: typed `as const` TS modules under `src/lib/library/`.** Locked verbatim copy and library shape live in `copy-and-content.md`. The set of files and what's server-only is summarized there. Library validation runs at module load and throws if `formats`/`themes`/`art_styles`/`pronouns` are below minimums (spec's Stage 0 rule).

Types are discriminated unions (`type ArtStyleId = 'cinematic_realism' | ...`) shared by the API layer and the wizard. No code-splitting in Phase 1; revisit when Phase 5 adds 144 music tracks.

---

## 4. API surface for Stages 1–3

Full request/response shapes, runtime config, idempotency, and rate-limit policy live in `api-routes.md`. The route list below is the index — backend should treat `api-routes.md` as authoritative.

All routes: `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`. Match the request/response convention from `feat/lead-emails-smtp:src/app/api/lead/route.ts` (`{ ok: true, ... }` / `{ ok: false, error }`).

| Route | Method | Calls vendor-layer capability |
|---|---|---|
| `/api/session/create` | POST | — |
| `/api/session/[id]` | GET/PATCH/DELETE | — |
| `/api/upload` | POST | — |
| `/api/ingest-url` | POST | — |
| `/api/vision-pass` | POST | `runVisionPass()` |
| `/api/character-sheet/render` | POST | `generateImage()` |
| `/api/character-sheet/approve` | POST | — |
| `/api/preview/render` | POST | `generateImage()` |
| `/api/preview/approve` | POST | — |

**Server Actions vs Route Handlers:** vendor-touching work = Route Handlers (explicit timeout, abort handling, `maxDuration = 90`). Pure DB writes (intake field saves, Stage 3 pill picks) can be Server Actions invoked from the form components.

**Idempotency:** all render routes accept an `Idempotency-Key` header; unique index on `renders (session_id, stage, idempotency_key)`. Duplicate within 60s short-circuits to the existing row. This is what kills the "user double-taps Re-render" cost spike.

**Long-running:** Stage 2 + 3.5 image renders fit in 30–45s. Video generation later needs a queue (BullMQ on Redis, or webhook callbacks from fal) — out of scope here.

### Photo upload path

**Pick: multipart POST → S3 in Phase 1; refactor to presigned PUT-from-browser when payloads pass ~3 MB.** Considered: (a) multipart through Next route, (b) presigned PUT direct from browser, (c) base64 in JSON. (c) rejected (4 MB cap + 33% bloat). (a) is the simplest; pet photos are 1–3 MB. One-day refactor to (b) later.

**URL ingestion (Drive/Dropbox/HTTPS):**
- Drive `/file/d/<id>/view` → `https://drive.google.com/uc?export=download&id=<id>`
- Dropbox `?dl=0` → `?dl=1`
- HEAD the URL; require `Content-Type: image/*` (not HTML viewer page)
- **Always rehost to S3.** Vendor endpoints can fetch direct URLs, but Drive permissions get revoked and 302-redirect-chains fail. One-time bandwidth cost, bulletproofs every downstream call.

---

## 5. Photo storage

**Pick: AWS S3** ($0.023/GB-month standard, $0.09/GB egress in us-east-1; CloudFront in front of the bucket is the assumed serving path so egress is billed at CloudFront rates rather than raw S3). Bucket `peterna-tribute-assets`. Keys: `sessions/<id>/{photos,renders,clips}/<uuid>.<ext>`. Public read via `assets.peterna.com` (CloudFront distribution).

- **Why S3 over Cloudflare R2:** Xee already operates an AWS fleet; one fewer vendor account and IAM surface. The egress premium vs. R2 is real but tractable at Phase-1 traffic, and CloudFront in front collapses repeated reads of the same asset (vendor fetches, user re-views) into edge-cached hits.
- **Why not Vercel Blob:** fine for tiny artifacts; egress will bite once we add video.

Retention: 30-day inactivity purge via S3 lifecycle rule + a daily cron that reaps DB rows. "Delete my tribute" bypasses the wait.

Drive-link normalization is **our** responsibility — the spec ducks it into the user's lap by passing raw URLs to Higgsfield; we own it in `ingest-url`.

---

## 6. UI translation of wizard widgets

Five widget patterns → five React primitives under `src/components/builder/`. Component architecture, state-machine model, and the convention "inline `style={{}}` + tokens from `src/lib/peterna-tokens.ts`, no Tailwind layout, no UI library" live in `ui-components.md`. Frontend agent should treat `ui-components.md` as authoritative.

The state machine in `src/lib/builder/state.ts` is a tagged union covering Stages 1–3 explicitly (intake_welcome → combination_preview_review). The reducer is reused server-side by `PATCH /api/session/[id]` to reject illegal skip-ahead.

**Stage 1.0 anti-trauma copy:** translates **verbatim** — see `copy-and-content.md`. Render as full-bleed centered panel with `FONT_DISPLAY`, larger leading, warm cream background. No "Continue" button — per spec the user advances by completing the next form (`intake_photos`) below.

---

## 7. Phased build plan

Authoritative version with definitions-of-done and agent-dispatch order lives in `phase-plan.md`. The summary:

| Phase | Scope | Routes added | Components added | Env vars | E2E testable |
|---|---|---|---|---|---|
| **1 — Intake (Stage 1)** [M] | Welcome, photos, name, vision pass, "Here's what I see," gender, relationship, traits, favorites, creator, years. No image renders. | `session/create`, `session/[id]` (GET/PATCH/DELETE), `upload`, `ingest-url`, `vision-pass` | `WizardShell`, `PhotoUrlField`, `PillPicker`, `TextField`, `ConfirmationCard`, `StageBanner` | `DATABASE_URL`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `FAL_KEY`, `SESSION_SECRET` | User walks intake, sees inferred profile card, edits fields, saves, resumes via link |
| **2 — Character Sheet (Stage 2)** [M] | 4-view 2K sheet, approval gate, field-level refinement loop, unlimited re-rolls, lock + transition. Length (2.5) + aspect (2.6) pickers. | `character-sheet/render`, `character-sheet/approve` | `GateReview`, `CharacterSheetView` | (no new) | User completes intake, sees pet rendered 4-up, approves or refines, picks length + aspect |
| **3 — Format/Theme/Style (Stage 3)** [L] | Curator's Picks (relationship-ordered), 3.1.5 style confirm, manual path (format → category → theme → style), combination preview, approval. | `preview/render`, `preview/approve` | `CuratorPickGrid`, `FormatGrid`, `ThemeCategoryGrid`, `ThemeGrid`, `StyleGrid`, `CombinationPreviewReview` | (no new) | User finishes Stages 1+2+3 with a locked combination preview frame of their pet |

**Sequence advice:** Ship Phase 1 to a hand-off shape first, then 2, then 3. Don't try to land 1+2+3 in one PR. Stage 2 is where the spec calls out "wrong-looking pet ruins the tribute" — it deserves its own QA cycle with real users (you, Xee) before any Stage 3 code lands.

**Deferred (not designed here):** Phase 4 beat sheet + storyboard, Phase 5 The Words + card preview, Phase 6 cinematography engine, Phase 7 Seedance video + assembly, Phase 8 eulogy PDF.

---

## 8. What does NOT translate from the spec

| Spec construct | Web-app translation |
|---|---|
| `show_widget` HTML templates | React components in `src/components/builder/` — don't render the spec's raw HTML, it's paste-adapt for Claude |
| `AskUserQuestion` | A `PillPicker` form submit inside `WizardShell` |
| `view` tool (in-sandbox multimodal) | `/api/vision-pass` → `runVisionPass()` (OpenAI → Gemini fallback) |
| `Higgsfield:generate_image` / `generate_video` | `src/lib/ai/` capabilities — `generateImage()`, `generateVideo()` |
| `/mnt/user-data/outputs/` writes | S3 bucket via `src/lib/storage/s3.ts` |
| `Higgsfield:media_upload` + curl PUT + `media_confirm` | Not needed — vendor endpoints fetch from S3 public URLs |
| "Silent inference" stages (0, 1.4) | Server-side at request time |
| "Stuck-widget" fallback line | Footer hint only on form-submit error; not on every screen |
| Curator's Pick library mutation on completion | Drop — not relevant; we are not emitting a new SKILL.md |
| `/mnt/user-data/outputs/peternal-library-working.json` mechanic | Drop — library is TS modules |
| `tribute_history: []` in YAML | Postgres `sessions` table |
| Stage 1.0 anti-trauma copy | **Verbatim** — see `copy-and-content.md` |

---

## 9. Risk register (top-line)

Full table with severity, mitigations, decision-log placeholder, and owner: see `risk-register.md`. The top 5:

| # | Risk | Sev | One-line mitigation |
|---|---|---|---|
| 1 | **Likeness drift at Stage 2** — spec's named "single failure mode." | **Critical** | Multi-photo upload encouraged; refinement loop appends user corrections to the prompt; unlimited re-rolls audited in `renders` table. |
| 2 | **Cost runaway from re-roll storms.** Double-tap Re-render burns ~$0.80 in 10s. | High | `Idempotency-Key` header dedupe + per-session render budget cap + 1-in-flight constraint. |
| 3 | **PII / data deletion for grieving users.** Photos of deceased pets are deeply personal. | High | "Delete my tribute" cascading delete + 30-day inactivity purge + no email captured by default. |
| 4 | **Single-point-of-failure for video.** fal.ai is the only viable Seedance vendor from US as of 2026-05-21 (no direct ByteDance/Volcengine API). | Medium-High | Vendor abstraction is built to accept a direct vendor module later without route-handler edits; sessions persist across fal outages with "your tribute is saved — finishing the video is paused" UX. Monitor fal status, revisit if a direct API opens. |
| 5 | **Vision-pass false confidence** — model says "high confidence: chocolate lab" but pet is a flat-coated retriever; user defers. | Medium | "Looks like" / "I see" copy per spec; per-field edit chips; log overrides to revise prompt if any field is corrected >30% of sessions. |

---

## Open questions for Xee

1. Resume link: email-gated up front, or pure URL share? **Recommend pure URL Phase 1**, add "email me my link" Phase 2.
2. ~~Postgres host (Neon/Supabase/RDS/self-hosted)~~ — **Decided 2026-05-21: Postgres confirmed; local for dev, production host TBD with deploy target.**
3. ~~Hosting target~~ — **Deferred 2026-05-21:** decide later. Phase 1 build doesn't depend on it. `maxDuration` tuning happens when target is picked.
4. ~~BytePlus enterprise account~~ — **Decided 2026-05-21:** fal.ai is sole Seedance vendor; no direct ByteDance/Volcengine API available from US. Single-vendor risk accepted (Risk #4).
5. Confirming we're starting fresh on `v3-zeeshan` — `feat/tribute-builder-v2` is reference only.
