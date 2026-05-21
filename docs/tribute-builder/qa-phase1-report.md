# Phase 1 integration QA — 2026-05-21

Scope: static integration audit at commit `c59582e` on `v3-zeeshan`. Build + lint pass; no live env is wired (no DB / R2 / OpenAI / Gemini / fal credentials), so this report is purely contract / static analysis.

The headline finding: **the backend and frontend agents standardized on different casing conventions for every JSON wire field.** Backend speaks camelCase (`sessionId`, `assetId`, `publicUrl`, `petName`); frontend speaks snake_case (`session_id`, `asset_id`, `public_url`, `pet_name`). Every cross-boundary call is broken. The build is green because there are no shared TypeScript types between request/response shapes — both sides defined their own ad-hoc `Record<string, unknown>` envelopes.

---

## Blockers (must fix before live E2E)

### B1. Casing mismatch on every JSON wire field — frontend ↔ backend cannot talk
- Severity: blocker
- Files:
  - `src/app/api/session/create/route.ts:36` returns `{ sessionId, resumeToken }`
  - `src/components/builder/BuilderClient.tsx:131-133` expects `{ session_id, resume_token }`
  - `src/app/api/upload/route.ts:32-35,73` reads form field `sessionId`, returns `{ assetId, publicUrl }`
  - `src/components/builder/PhotoUrlField.tsx:148` sends form field `session_id`; `:154` expects `{ asset_id, public_url }`
  - `src/app/api/ingest-url/route.ts:30,66-69` reads body `sessionId`, returns `{ assets: [{ assetId, publicUrl }], failed }`
  - `src/components/builder/PhotoUrlField.tsx:247` sends body `session_id`; `:252` expects `{ assets: [{ asset_id, public_url }] }`
  - `src/app/api/vision-pass/route.ts:40,103` reads body `sessionId`, returns `{ profile, confidence }`
  - `src/components/builder/BuilderClient.tsx:218,221,231` sends body `session_id`; expects `{ inferred_profile, confidence }` (response shape also wrong — see B2)
  - `src/app/api/session/[id]/route.ts:109-128` (PATCH allowlist) accepts `petName, petGender, personalityTraits, favoriteThings, creatorName, yearsLabel, memoryPromptType, memoryPromptAnswer, returningUser` (camelCase)
  - `src/components/builder/BuilderClient.tsx:74-88,261-264,300,338,355,492,514,540,551,576,587,607` sends `pet_name, pet_gender, personality_traits, favorite_things, creator_name, years_label, memory_prompt_type, memory_prompt_answer, is_returning_user` (snake_case)
- Effect: every PATCH silently drops every field except `stage` (the one field whose name happens to match). The session in Postgres will accumulate `stage` transitions but the pet name, photos, traits, etc. will never persist. Vision-pass returns null inferred_profile to the frontend → confirmation card stays in "vision_failure" fallback forever. Upload component receives `{ assetId, publicUrl }`, reads `json.asset_id` → `undefined` → `PhotoAsset[]` carries `asset_id: undefined`, the next call's `pet_photos[]` is bogus.
- Fix (smallest workable): pick one convention. `api-routes.md` is silent on casing; `data-model.md` is snake_case (it's SQL). Recommend snake_case everywhere on the wire (Drizzle already maps to camelCase for the ORM layer; that's an internal concern). Convert in the backend: rename `okJson` outputs to snake_case keys, rename PATCH `STRING_FIELDS` to snake_case (`pet_name`, `pet_gender`, etc.) and look them up against the body's snake_case keys before mapping to Drizzle's camelCase setter.

### B2. `vision-pass` response shape doesn't match what BuilderClient reads
- Severity: blocker
- File: `src/app/api/vision-pass/route.ts:103` returns `okJson({ profile, confidence })`
- Client at `src/components/builder/BuilderClient.tsx:221,228,231` reads `json.inferred_profile`
- Effect: even after B1 is fixed (snake_case alignment), the field name is wrong. `inferred_profile in json` is false, so the wizard treats every successful vision pass as nothing happened, stays in `intake_vision_review`, and the user never advances past 1.5.
- Fix: rename the route's response field to `inferred_profile` (matching the DB column name and the spec at `api-routes.md:48`).

### B3. PATCH allowlist omits `inferredProfile` and `returningUser` outright
- Severity: blocker
- File: `src/app/api/session/[id]/route.ts:109-136`
- Effect: even with B1+B2 fixed, two persistence paths still don't work. The `ConfirmationCard`'s "tap to correct" edits send `{ inferred_profile: <edited> }` — server rejects (drops). Returning-user answer (Stage 1.1) sends `{ is_returning_user: true }` — server drops.
- Fix: add `inferred_profile` to a new JSON_FIELDS allowlist (jsonb column, must validate it's an object), and add `is_returning_user` to BOOL_FIELDS (mapped to Drizzle's `returningUser`).

### B4. `/builder/r/<token>` resume page reads wrong response shape — every resume link silently creates a new session
- Severity: blocker
- File: `src/app/api/session/resume/[token]/route.ts:41` returns `okJson({ session: <Session row> })`
- File: `src/app/builder/r/[token]/page.tsx:25,58-59` types/reads `{ ok: true, session_id, stage? }`
- Effect: `json.session_id` is `undefined` on every resume, so the page falls through to `redirect("/builder")` — a fresh session is created, the user's old work is unreachable. This silently breaks the entire resume-link feature, including the DoD line "resume link at `/builder/r/<token>` works."
- Fix: in the route, return `okJson({ session_id: row.id, stage: row.stage, resume_token: row.resumeToken })` (matching the contract documented at `api-routes.md:17` and the page's read). Or, on the page side, switch to reading `json.session.id` / `json.session.stage` — but the route shape is non-spec; better to fix the route.

### B5. State machine is not server-validated; PATCH trusts any client-supplied `stage`
- Severity: blocker (per the spec at `api-routes.md:28`)
- File: `src/app/api/session/[id]/route.ts:46-72` (PATCH handler)
- File: `src/lib/builder/state.ts` (the reducer that should be the single source of truth)
- The handler comments admit this gap ("the full state-machine transition guard … is the frontend agent's territory") — but `api-routes.md` is explicit: illegal skip-ahead must return `400 { error: 'invalid-stage-transition' }`. The reducer is also pure, importable by Node, no client-only deps — there's no implementation barrier.
- Effect: a malicious or buggy client can PATCH `stage: 'stage_3_complete'` from any state, bypassing intake entirely. When Phase 2 lands and stage transitions gate render budgets, this becomes a $$ exploit.
- Fix (smallest): in PATCH, if `stage` is in the body, load the current session row's `stage` first, then call `reduceState({ stage: current, data: <reconstructed> }, { type: 'goto', stage: <new> })` to validate. Reject with `400 invalid-stage-transition` if `reduceState` returns the same stage. The reducer's `goto` event is a back-door though — better: derive a `legalNextStages(current): StageTag[]` helper from the reducer and assert `new ∈ legalNextStages(current)`.

### B6. No per-session asset count cap — storage-runaway risk
- Severity: blocker (it's in the spec: `api-routes.md:38` "10 files per session")
- File: `src/app/api/upload/route.ts` — only checks per-file size (10MB), not per-session count
- File: `src/app/api/ingest-url/route.ts:38` — only caps per-call array length, not per-session aggregate
- Effect: a user (malicious or buggy retry loop) can upload 10,000 files × 10 MB = 100 GB into one session's R2 prefix. R2 is paid-by-byte. The client-side `MAX_FILES=10` in `PhotoUrlField.tsx:44` is cosmetic.
- Fix: before the R2 PUT in both routes, `SELECT count(*) FROM assets WHERE session_id = $1 AND kind = 'pet_photo'`. If `≥ 10`, return `413 { error: 'too-many-photos', limit: 10 }`. Same on ingest-url, after success-by-success (since some URLs may fail).

---

## Bugs (should fix before user-facing demo)

### Bug-1. `DELETE /api/session/[id]` does not tolerate R2 failures gracefully
- File: `src/app/api/session/[id]/route.ts:93-102`
- The loop calls `deleteObjects` with no try/catch. If R2 throws (network, throttling, partial delete), the entire route 500s and the DB row is never dropped — meaning the cookie is never cleared either. The user sees an opaque error. A retry would re-list the same keys (S3 delete is idempotent for already-deleted keys, so this self-heals), but the UX is poor.
- Fix: wrap `deleteObjects` in try/catch; on partial failure, log the keys that fell through and still proceed with the DB delete + cookie clear. The R2 lifecycle rule (`data-model.md` §"Lifecycle / retention") sweeps stragglers within 30 days. Document the trade in the route comment.

### Bug-2. Per-IP rate limit defined but never invoked
- File: `src/lib/session/rate-limit.ts:84-109` (`consumePerIp`, `extractClientIp`)
- Spec at `api-routes.md:82`: "Per-IP (middleware): 60 req/min across all `/api/*` routes."
- No `middleware.ts` exists in the project; no route calls `consumePerIp`. The rate-limit module's own comment says "routes can call `consumePerIp(req)` at the top" — but no route does.
- Fix: either add a `src/middleware.ts` that runs `consumePerIp(extractClientIp(req.headers))` for any path matching `/api/*`, or add a `withPerIpLimit()` wrapper invoked at the top of each route handler. Middleware is cheaper to maintain.

### Bug-3. In-memory rate-limit map leaks for sessions that finished
- File: `src/lib/session/rate-limit.ts:29` (`const sessions = new Map<…>`)
- `release()` only decrements `inFlight`, never deletes the entry. A long-running process accumulates one entry per session it ever served, with `count` and `windowStart` stuck even past the 1-hour window. Same for the IPs map (line 76).
- Phase 1 acceptable behavior per the task spec is "counters reset on restart," but unbounded growth between restarts is still a leak. With multi-instance hosting (Vercel) this is also dishonest about its enforcement guarantees.
- Fix (minimum): periodically reap entries whose `windowStart + HOUR_MS < now` and `inFlight === 0`. A `setInterval` is fine for Phase 1; in Phase 2 this moves to Redis with TTL anyway.

### Bug-4. `WELCOME_LINES` is not character-for-character identical to the locked spec
- Spec at `SKILL (5).md:339-350` — paragraphs 2 and 3 have hard line breaks within them
- File: `src/lib/library/copy.ts:18-23` — the codebase joins each paragraph into one long line (drops the internal line breaks after "passed.", after "skippable.", and after "rush,")
- The text content (words, punctuation) is identical, and CSS could in principle re-flow this; but the spec is explicit ("do not paraphrase, condense, or extend") and the welcome panel uses one `<p>` per `WELCOME_LINES[i]` so the original line breaks are not recoverable. Whether this matters is a Xee judgment call — flag it because the spec is unusually emphatic.
- Fix: either split into 6 entries (one per spec line) or render each entry with `white-space: pre-line` and put the `\n`s back in the constant. The simpler change is to split:
  - `WELCOME_LINES[1] = "Before we begin — I won't ask you about their last day, or how they passed."`
  - `WELCOME_LINES[2] = "If you ever want to share that, you can, but I'll never push for it."`
  - and update `WelcomePanel.tsx` to render them as separate `<p>` (or `<br/>`-joined within a single `<p>`).

### Bug-5. Idempotency-Key header / unique index not populated by vision-pass
- File: `src/lib/ai/run-vision-pass.ts:55` — `idempotencyKey = randomUUID()` per call
- Spec at `api-routes.md:11`: "Idempotency: render routes accept `Idempotency-Key` header (UUID v7); unique on `renders(session_id, stage, idempotency_key)`. Duplicate within 60s short-circuits to the existing row."
- The route ignores any `Idempotency-Key` header (or rather, never reads `req.headers.get('idempotency-key')`). A double-tap on the wizard fires two vision passes; both write distinct rows; both pay vendor cost; both race to update the session.
- The unique index exists in `schema.ts:104-108` — only the inserter side is broken.
- Phase 1 partial-mitigation: the per-session in-flight slot (`acquireSessionSlot`) does prevent two parallel calls. But it does NOT prevent two sequential calls 100ms apart (the first releases its slot, the second acquires it). And it doesn't help once render routes land in Phase 2.
- Fix (Phase 1 minimum): read `Idempotency-Key` from `req.headers`; if present, pass it through to `runVisionPass` and to `logRender`; rely on the DB unique index to throw on duplicates and translate to a 200 with the existing render's profile. Frontend should generate a UUID once per `useEffect` fire and include it on retry.

### Bug-6. PATCH never validates `stage` against the StageTag enum
- File: `src/app/api/session/[id]/route.ts:109-167`
- `stage` is in `STRING_FIELDS` and accepted as any string. Combined with B5, a client can PATCH `stage: 'lol_eaten_by_a_dragon'` and the DB row's `stage` column happily takes it. The next page reload restores from a bogus stage tag, the reducer's `default` case kicks in (returns `state` unchanged), and the user is stranded.
- Fix: validate `stage` against the known `StageTag` union (import or literal-list). Same place where B5's transition guard goes.

### Bug-7. `BuilderClient.dispatchAndSave` may PATCH stale `state.data` after dispatch
- File: `src/components/builder/BuilderClient.tsx:255-268`
- The closure captures `state` (line 268 dep), then dispatches synchronously, then PATCHes with `state.data.session_id` — which is fine for session_id. But the pattern is fragile: `next = reduceState(state, event)` runs through the reducer client-side as truth, but the server-side reducer (per B5) is the source of truth in the spec. Once B5 lands, the client could see a 400 `invalid-stage-transition` after it's already dispatched locally, leaving client and server out of sync.
- Fix: in `dispatchAndSave`, PATCH first; only dispatch on success. Or accept the divergence in Phase 1 and document it. The first option is cleaner once renders enter the picture in Phase 2.

### Bug-8. `PhotoUrlField.removeStatus` removes from `uploadedAssets` after a render — but `statuses.find(...)` uses pre-update state
- File: `src/components/builder/PhotoUrlField.tsx:222-231`
- After `setStatuses(prev => prev.filter(...))`, the next line reads `statuses.find(...)` — `statuses` is still the closed-over previous value (React batches the setter). Mostly works, but if the user double-clicks remove, the second click sees a `statuses` that lost the row already and can't find it, leaving the corresponding `uploadedAssets` entry orphaned. The user sees the thumbnail gone but the photo still gets submitted as part of `onComplete`.
- Fix: pass the assetId through the upload pipeline so `removeStatus` can drop by assetId rather than by `publicUrl`. (The current code admits this in a comment at line 167.)

### Bug-9. `acquireSessionSlot` increments `count` for a request that fails synchronously before doing any vendor work
- File: `src/lib/session/rate-limit.ts:54-59`
- Once `count >= 20`, the slot is refused. But `count` is also bumped when we acquired the slot and then the route's *own* validation downstream (`photos.length === 0` at vision-pass:64) returned 400. The release runs in `finally` and decrements `inFlight`, but `count` is never decremented. So 20 "no photos yet" mistaps from the user permanently lock out their vision pass for the next hour.
- Fix: move the `count += 1` after the vendor call succeeds, or expose a `releaseAndDontCount()` for the early-bailout case.

---

## Smells (low priority, follow-up)

### Smell-1. `BuilderClient.patchSession` swallows non-404 errors in dev only
- File: `src/components/builder/BuilderClient.tsx:106-116` — `if (!res.ok && res.status !== 404)` logs in dev, no-ops in prod. Once the backend exists, a 400 / 500 from PATCH will be invisible to the user. There's no toast, no retry, no "couldn't save" feedback. Phase 1 may be OK with this; Phase 2 won't be.

### Smell-2. The frontend's `SessionPatch` type drifts from the server's allowlist
- File: `src/components/builder/BuilderClient.tsx:74-88`
- No shared TypeScript type for the request body. After B1/B3 fixes, the two will still drift independently. Recommend extracting `src/lib/api/contracts.ts` (or similar) with one shared shape per route, imported by both sides.

### Smell-3. `extensionForMime` doesn't honor `image/jpeg; charset=…`
- File: `src/lib/storage/ingest-url.ts:139-156` and the corresponding `upload/route.ts:44` — both pre-strip the `; charset=…` suffix before calling `extensionForMime`, so this is fine in practice. But if any future caller forgets, the function silently returns `''` (no extension) and the R2 key looks like `…/uuid` with no suffix. Minor.

### Smell-4. `runVisionPass` order constant is hard-coded `['openai', 'gemini']` — fal never reachable
- File: `src/lib/ai/run-vision-pass.ts:66`
- The `AI_VENDOR_OVERRIDE` env var checks only `openai` and `gemini`. `vendors/fal.ts` exists but is never called for vision-pass — that's per the spec (fal is image-gen only). Just noting for completeness; the `vendor: 'fal'` branch in `callVendor` at line 145 will never trigger.

### Smell-5. `OPENAI_VISION_MODEL = 'gpt-4o-2024-11-20'` may be out of date
- File: `src/lib/ai/vendors/openai.ts:7`
- Today is 2026-05-21 (per project context); the pinned snapshot is from Nov 2024. Likely fine but worth a check — newer snapshots (gpt-4o-2025-04-…, etc.) may be cheaper or more accurate for vision tasks.

### Smell-6. Resume route rotates cookie token unconditionally — including for an authenticated user clicking their own resume link
- File: `src/app/api/session/resume/[token]/route.ts:30-37`
- The doc says this is intentional ("any prior device's cookie is now invalid"). But the user's *current* device — the one that just clicked the link — also loses any prior cookie association if it had one. In practice that's fine because we re-set the cookie on the same response. Note for ops.

### Smell-7. PATCH does not enforce enum constraints on `petGender`, `relationship`, `formatId`, etc.
- File: `src/app/api/session/[id]/route.ts:139-167`
- A client can send `petGender: 'martian'` and the row accepts it. Probably caught by downstream prompt-building later, but a 400 at write time is cleaner. Defer until B5's transition guard work — the same validator file can hold enum guards.

### Smell-8. The `intake_memory_freetext` stage exists in the URL allowlist but the spec doesn't separately number it
- File: `src/app/builder/page.tsx:35`, `src/lib/builder/state.ts:33`
- Spec has Stage 1.6 (memory picker) followed directly by Stage 1.7 (gender); the codebase adds a sub-stage `intake_memory_freetext` for the free-text follow-up. This is a frontend implementation detail — fine — but worth documenting in `ui-components.md` so it doesn't look like a bug to a future reader.

### Smell-9. The `ConfirmationCard` re-renders the vision-failure branch internally as a defensive fallback, duplicating what `BuilderClient` already routes
- File: `src/components/builder/ConfirmationCard.tsx:80-146` and `BuilderClient.tsx:368-405`
- Code paths are reachable from two directions. Defensive but a maintenance smell.

---

## Verified clean

- Cookie HMAC verification is timing-safe (`timingSafeEqual` at `src/lib/session/hmac.ts:37`).
- Cookie is `httpOnly`, `sameSite=lax`, `secure` in prod (`src/lib/session/cookie.ts:42-48`).
- `authBySession(expectedSessionId)` correctly compares cookie's encoded `sessionId` against the URL `[id]` and returns 403 `cookie-mismatch` on drift. No session-jacking via `/api/session/[other]`.
- All four photo-touching routes (`upload`, `ingest-url`, `vision-pass`, plus the implicit GET) hit `authBySession(sessionId)` before doing anything else.
- Drizzle schema matches `data-model.md` exactly (column names, types, indexes, unique constraints, cascade FKs).
- `ingestUrlToR2` correctly normalizes Drive `view` and Dropbox `?dl=0`, HEAD-probes for image content-type, GET-rejects non-image, and caps at 10 MB.
- Vendor layer correctly: OpenAI primary → Gemini fallback on retryable errors → `AIError(both_vendors_failed)` → route translates to `200 { vision_failure: true }`. No vendor names leak in the response envelope.
- Stage banner table in `STAGE_BANNERS` matches the spec's locked banner table verbatim (emoji + text).
- WELCOME copy text content matches the spec (modulo internal line breaks; see Bug-4).
- `okJson` / `errJson` envelope conventions are consistently applied across all six routes.
- `PhotoUrlField` rejects non-image and >10MB files client-side with a friendly inline error before posting.

---

## Recommended next steps

Ordered by leverage. Each item is the minimum unit a focused agent can pick up.

1. **B1 (casing standardization)** — pick snake_case on the wire. One PR that:
   - Rewrites `okJson({ sessionId, … })` calls in all six routes to snake_case keys.
   - Rewrites PATCH's `STRING_FIELDS`/`ARRAY_FIELDS`/`INT_FIELDS`/`BOOL_FIELDS` to snake_case names and maps them to Drizzle's camelCase setters via a `WIRE_TO_DRIZZLE` table (one place to maintain).
   - Renames the `upload` form field reader from `'sessionId'` to `'session_id'`.
   This unblocks B2/B3/B4/B6 review and unblocks any meaningful live test.

2. **B2 (vision-pass response field name)** — one-line change at `vision-pass/route.ts:103`. Bundle with B1.

3. **B3 (PATCH allowlist additions)** — add `inferred_profile` (jsonb validator) and `returning_user` (boolean) to the allowlist + Drizzle map. Bundle with B1.

4. **B4 (resume route response shape)** — fix in the route, not the page (the spec at `api-routes.md:17` documents the route's shape). Three-line change.

5. **B5 (server-side state-machine guard)** — implement `legalNextStages(current): StageTag[]` in `src/lib/builder/state.ts` (derivable from the reducer), call from PATCH when `body.stage` is present, return `400 invalid-stage-transition` if illegal. ~30 LOC.

6. **B6 (per-session photo count cap)** — one `SELECT count(*)` in `upload/route.ts` before the PUT, mirror in `ingest-url/route.ts` (cap minus current count). Returns `413 too-many-photos`. ~15 LOC each.

7. **Bug-1 (R2 delete try/catch)** — wrap `deleteObjects` in try/catch, log on partial failure, proceed with DB delete + cookie clear regardless.

8. **Bug-2 (per-IP middleware)** — new file `src/middleware.ts`: read IP, call `consumePerIp`, return 429 with `Retry-After` if over.

9. **Bug-5 (Idempotency-Key plumbing)** — read header in `vision-pass/route.ts`, thread to `runVisionPass`, catch unique-index violation at the DB layer and translate to a 200 with the existing render.

10. **Bug-4 (welcome copy line breaks)** — five-line change in `copy.ts`. Cheap to do; Xee should decide whether the line breaks matter.

11. **Bug-3 / Bug-9 (rate-limit hygiene)** — reaper + post-success increment.

12. **Smell-2 (shared contracts file)** — set up after B1 lands; it codifies what was just agreed.

After items 1–6, the Phase 1 routes are wire-correct and the wizard can E2E. After 7–9, the system is operationally honest about its limits and idempotency. Items 10–12 are polish.

---

## Fixes applied — 2026-05-21

Worked off this report on branch `v3-zeeshan`. Original findings left intact above as an audit trail. Build (`SKIP_LIBRARY_VALIDATION=1 npm run build`) and lint both green at HEAD.

**Design decision:** wire format is snake_case end-to-end. The TypeScript contract lives in the new `src/lib/builder/wire-types.ts` and is imported by every route handler under `src/app/api/**/route.ts` and by `src/components/builder/**` so neither side string-literal-types field names. Adding a session column now touches one place in `wire-types.ts` plus one place in the PATCH allowlist; drift is type-checked.

### Blockers

| ID | Status   | Notes |
|----|----------|-------|
| B1 | fixed    | All 6 routes now emit snake_case responses; PATCH allowlist switched to snake_case wire keys mapped to Drizzle setters via a `WIRE_TO_DRIZZLE` table. `upload` form field is `session_id`. Frontend imports `SessionPatchBody`, `VisionPassResponse`, `UploadResponse`, etc. from the shared module. |
| B2 | fixed    | `POST /api/vision-pass` returns `{ ok: true, inferred_profile, inferred_confidence }` (renamed from `{ profile, confidence }` — matches DB columns + spec at `api-routes.md`). Frontend reads `inferred_profile`. |
| B3 | fixed    | PATCH allowlist now includes `inferred_profile` (jsonb validator: object, not array) and `is_returning_user` (boolean → Drizzle `returningUser`). All `SessionPatchBody` keys are server-allowlisted. |
| B4 | fixed    | `POST /api/session/resume/[token]` returns `{ ok: true, session_id, stage, resume_token }` (was `{ session: <row> }` — the page never read that). Page at `/builder/r/[token]` reads via the shared `ResumeResponse` type. |
| B5 | fixed    | New `legalNextStages(current): Set<StageTag>` helper in `src/lib/builder/state.ts` derives the legal forward edges by probing the reducer with every non-`goto` event. PATCH validates `body.stage` against this set; illegal transitions → `400 { error: 'invalid-stage-transition', from, to }`. Same-stage PATCH is always legal (idempotent). |
| B6 | fixed    | `POST /api/upload` runs `SELECT count(*) WHERE kind='pet_photo'` before the R2 PUT; ≥10 → `413 too-many-photos`. `POST /api/ingest-url` treats the cap as a running budget — URLs over the budget land in `failed[]` with `reason: 'too_many_photos'`. |

### Bugs

| ID    | Status   | Notes |
|-------|----------|-------|
| Bug-1 | fixed    | `DELETE /api/session/[id]` wraps each `deleteObjects` batch in try/catch; logs the batch size on failure and proceeds with the DB delete + cookie clear. R2 lifecycle rule sweeps stragglers within 30 days. |
| Bug-2 | fixed    | New `src/proxy.ts` (Next 16 file convention; was `middleware.ts` pre-Next-16) runs `consumePerIp(extractClientIp(req.headers))` on every `/api/*` request and returns 429 + `Retry-After` when over the 60 req/min cap. |
| Bug-3 | fixed    | Rate-limit map now has a 5-minute `setInterval` reaper that drops session entries where `windowStart + HOUR < now && inFlight === 0`, and IP entries past 2× window. The handle is `.unref()`ed so it doesn't keep the loop alive in tests. |
| Bug-4 | deferred | The locked-copy edit is explicitly out of scope per the orchestrator brief ("Do not change the locked verbatim copy"). The QA report itself flags this as a Xee judgment call. Recommend revisiting with PM if the welcome-panel line breaks read poorly across screens. |
| Bug-5 | fixed    | `POST /api/vision-pass` reads `Idempotency-Key` from request headers and threads it into `runVisionPass({ ..., idempotencyKey })` via the new optional `VisionPassInput.idempotencyKey` field. Frontend mints one UUID per `useEffect` fire via `crypto.randomUUID()` and sends it on the call. Duplicate-within-60s short-circuits via the existing DB unique index. |
| Bug-6 | fixed    | PATCH validates `body.stage` against the runtime `STAGE_TAG_SET` (derived from `ALL_STAGE_TAGS`, kept in sync with `StageTag`). Unknown tags → `400 invalid-input { field: 'stage' }`. |
| Bug-7 | partial  | Kept optimistic client-side dispatch (UX latency win); documented in `BuilderClient.patchSession` that a server-side `invalid-stage-transition` will be logged but recovery is reload. The full PATCH-first pattern lands cleanly in Phase 2 when render gates make divergence costly. |
| Bug-8 | fixed    | `PhotoUrlField.removeStatus` now reads the target's `asset_id` inside the `setStatuses` callback (so double-clicks see the latest state) and removes from `uploadedAssets` by `asset_id` instead of `publicUrl`. The `UploadStatus` type carries `assetId` alongside `publicUrl`. |
| Bug-9 | fixed    | `acquireSessionSlot` returns a `slot` with `commit()` / `releaseAndDontCount()` instead of a plain `release()`. The hourly-cap counter is only incremented on `commit()`, which the vision-pass route calls after the vendor work succeeded. Early bailouts (no photos uploaded yet) call `releaseAndDontCount()` so mistaps don't lock users out for an hour. Legacy `release()` is kept as an alias for `commit()` so older callers don't break. |

### Smells

Deferred per scope. Smell-2 (shared contracts file) was effectively addressed as a side-effect of B1 — `src/lib/builder/wire-types.ts` is now the shared contracts module the smell asked for.

### False alarm

The QA report flagged the `Idempotency-Key` plumbing (Bug-5) as a vision-pass gap, which it is. But the corresponding partial-mitigation note about the per-session in-flight slot still holding — that part was wrong: the slot also bumps the *hourly* counter, so two sequential calls 100ms apart not only race, they also burn two of the 20-per-hour budget. Fixed both gaps with the Bug-9 change (count-on-success) and the Bug-5 plumbing.

### Commits

See `git log --oneline v3-zeeshan ^c59582e` for the chunked history. Build + lint final status: green. Lint shows 2 pre-existing `_input` unused warnings in `lib/ai/generate-image.ts` / `generate-video.ts` (Phase 2 stubs) — out of scope.

### What live E2E will still need to validate (added by this pass)

- The PATCH `invalid-stage-transition` 400 — needs a real malicious-client probe (curl with `stage: 'stage_3_complete'` against a fresh session) to confirm it rejects rather than 500ing.
- The per-session `too-many-photos` 413 — needs an 11th-upload run to confirm the count predicate matches the schema's actual `kind` value.
- The reaper running on a long-lived dev server — `__test.sessions.size` should plateau under sustained synthetic load.
- The proxy 429 firing — needs an IP-flood test to confirm the matcher actually catches `/api/*` and the 60/min math holds.
- The resume-link redirect flow — needs a clean end-to-end through `/api/session/create` → save some state → `/builder/r/<resume_token>` → `/builder?session=...&step=...` with the right cookie rotation.

---

## What live E2E will still need to validate (static can't catch)

- Whether the OpenAI client's `response_format: { type: 'json_schema', json_schema, strict: true }` actually works against `gpt-4o-2024-11-20` in 2026 (OpenAI has shifted the strict-schema shape; the type signatures compile but the runtime contract is the question).
- Whether `@google/genai`'s `responseJsonSchema` config option still exists by that name (the package is fast-moving — the vendor file notes this).
- Whether R2's S3-compatible `DeleteObjects` request returns the per-key error array we'd need to act on (currently treated as all-or-nothing).
- Whether the Cloudflare custom-domain `R2_PUBLIC_BASE_URL` actually serves the keys we built (URL encoding of UUIDs with periods, etc.).
- Whether the welcome panel's `WELCOME_LINES` line breaks render correctly across screens; this is a CSS question, not a contract question.
- Drive viewer-page detection at scale: the HEAD probe works for the common case, but Google's anti-bot has been known to return `200 OK` with `text/html` for `/uc?export=download` URLs over a quota threshold. Real photos from real users will surface edge cases the spec doesn't cover.
- Vendor failure modes that the static review can't reproduce: an OpenAI `model_overloaded` 503 burst, a Gemini safety filter false-positive on cute-pet photos, a stalled connection that doesn't trip the 12s timeout. Telemetry from `renders.error` will be the only signal.
- The actual cost-per-vision-pass — `ESTIMATED_VISION_COST_USD = 0.005` is a constant in the code; live billing will tell us if the budget math is right before Phase 2 renders push it 100×.
