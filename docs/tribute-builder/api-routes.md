# API routes — Phase 1 surface (Stages 1–3)

**Owner / agent type:** Backend (route handlers).
**Prerequisites:** read `vendor-layer.md` and `data-model.md` first.

## Conventions

- All under `src/app/api/`. All `export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'`. Long-running routes: `export const maxDuration = 90`.
- Response envelope: `{ ok: true, ...data }` on success; `{ ok: false, error: <kebab-string>, ...details }` on failure. Mirrors the existing `feat/lead-emails-smtp:src/app/api/lead/route.ts` pattern.
- **Wire format is snake_case across the board** — request bodies, response fields, multipart form fields. Matches the Postgres column names (the DB is the source of truth). The TypeScript contract lives in `src/lib/builder/wire-types.ts` and is imported by both route handlers and the frontend builder client, so field names are type-checked, not string-literal-typed in two places.
- Auth: HMAC-signed cookie. Every route except `session/create` and `session/[id]` GET-via-resume-token requires the cookie match.
- Idempotency: vendor-touching routes (`vision-pass`, and render routes in Phase 2) read `Idempotency-Key` header (UUID v7) and thread it through to the `renders` insert. The unique index on `renders(session_id, stage, idempotency_key)` short-circuits duplicates within the dedup window.
- Per-IP rate limit (60 req/min across `/api/*`) is enforced in `src/proxy.ts` (Next 16 file convention; was `middleware.ts` pre-Next-16).

## Routes

### `POST /api/session/create`
- Body: `{}`
- Returns: `{ ok: true, session_id, resume_token }`
- Side effects: row in `sessions`, sets httponly `peterna_session` cookie.

### `GET /api/session/[id]`
- Query param `?resume=<token>` accepted in lieu of cookie for shareable resume links.
- Returns: full session JSON (all columns; `inferred_profile` included).
- 403 on cookie/resume mismatch.

### `PATCH /api/session/[id]`
- Body: partial session fields, all snake_case to match the DB. Allowlist (must mirror `SessionPatchBody` in `src/lib/builder/wire-types.ts`):
  - strings: `stage`, `pet_name`, `pet_name_pronunciation`, `pet_gender`, `relationship`, `memory_prompt_type`, `memory_prompt_answer`, `creator_name`, `years_label`, `aspect_ratio`, `curators_pick_id`, `format_id`, `theme_id`, `style_id`
  - arrays of strings: `personality_traits`, `favorite_things`
  - integers: `beat_count`, `target_minutes`
  - booleans: `is_returning_user`
  - JSON objects: `inferred_profile`
- Anything outside the allowlist is silently dropped (not an error — the spec lets the wire grow without breaking older clients).
- Returns: `{ ok: true, session: <full session JSON> }`.
- Server validates `stage` transition against `legalNextStages(current)` (derived from the state-machine reducer in `src/lib/builder/state.ts`). Unknown stage tags → 400 `invalid-input`. Illegal transitions → 400 `{ ok: false, error: 'invalid-stage-transition', from, to }`. Same-stage PATCHes are always legal (idempotent).

### `DELETE /api/session/[id]`
- Cascades: DB rows deleted, R2 `DeleteObjects` called for all assets.
- R2 failures are tolerated: each delete-batch is wrapped in try/catch, the keys are logged on partial failure, and the DB delete + cookie clear proceeds regardless. The R2 lifecycle rule (`data-model.md` §"Lifecycle / retention") sweeps stragglers within 30 days.
- Returns: `{ ok: true }`.

### `POST /api/session/resume/[token]`
- Auth: the resume token in the URL is the auth — no cookie required.
- Rotates `sessions.cookie_token` and sets a fresh `peterna_session` cookie on the response so any prior device's cookie stops working.
- Returns: `{ ok: true, session_id, stage, resume_token }`. The frontend resume page at `/builder/r/<token>` reads these fields directly and redirects to `/builder?session=<id>&step=<stage>`.

### `POST /api/upload`
- Multipart form: `file` (image/*) + `session_id` (snake_case form field).
- Streams to R2 at `sessions/<id>/photos/<uuid>.<ext>`. Inserts `assets` row with `kind='pet_photo'`, `source='upload'`.
- Returns: `{ ok: true, asset_id, public_url }`.
- Limits: 10 MB per file, 10 files per session. Per-session cap is enforced via a `SELECT count(*) WHERE kind='pet_photo'` before the R2 PUT; the client-side `MAX_FILES=10` is cosmetic. Returns `413 { error: 'too-many-photos', limit, current }` on overflow.

### `POST /api/ingest-url`
- Body: `{ session_id, urls: string[] }` (max 10)
- For each URL: normalize (Drive `view` → `uc?export=download&id=...`; Dropbox `?dl=0` → `?dl=1`), HEAD-check (require `Content-Type: image/*`), download server-side, rehost to R2.
- Per-session photo cap (same 10-photo limit as `/api/upload`) is enforced as a running budget — URLs over the budget land in `failed[]` with `reason: 'too_many_photos'` instead of failing the whole batch.
- Returns: `{ ok: true, assets: Array<{ asset_id, public_url }>, failed: Array<{ url, reason }> }`.

### `POST /api/vision-pass`
- Body: `{ session_id }`. Server reads `pet_photos[]` (all asset rows with `kind='pet_photo'`).
- Headers: optional `Idempotency-Key: <uuid v7>`. The DB unique index on `renders(session_id, stage, idempotency_key)` short-circuits duplicate vendor calls inside the dedup window.
- Calls `runVisionPass({ photos, schema: petProfileSchema, sessionId, idempotencyKey })`.
- On success: persists `inferred_profile` + `inferred_confidence` to session, returns `{ ok: true, inferred_profile, inferred_confidence }`. Field names are snake_case to match the DB column names (`sessions.inferred_profile`, `sessions.inferred_confidence`).
- On `AIError`: returns `{ ok: true, vision_failure: true }` (200 — the failure path is a UX state, not a transport error). UI degrades to v0.7 explicit-question flow.
- Per-session hourly-cap counter is only committed on a real vendor success — early bailouts (no photos uploaded yet) release the in-flight token without burning a slot.

### `POST /api/character-sheet/render`
- Body: `{ session_id, refinements?: string[], extra_photos?: string[] }`. `refinements` are spec §2.3 corrections appended to the prompt.
- Builds prompt from `src/lib/prompts/build-character-sheet.ts` (uses `pet_name`, `inferred_profile`, all `pet_photos[]`).
- Calls `generateImage({ stage: 'character_sheet', size: '2048x2048', quality: 'high', references: <all photos>, ... })`.
- On success: inserts `assets` row `kind='character_sheet'`, returns `{ ok: true, render_id, asset_id, public_url }`.
- Rate-limit: 1 in-flight per session; `Retry-After: 5` header on conflict.

### `POST /api/character-sheet/approve`
- Body: `{ session_id, asset_id }`.
- Sets `sessions.character_sheet_asset_id = asset_id`, advances stage to `length_pick`.
- Returns: `{ ok: true }`.

### `POST /api/preview/render`
- Body: `{ session_id }`. Requires `character_sheet_asset_id`, `format_id`, `theme_id`, `style_id`, `aspect_ratio` set.
- Prompt from `src/lib/prompts/build-preview.ts`; passes character sheet URL as the sole reference (`references: [{ url, role: 'subject' }]`).
- Calls `generateImage({ stage: 'combination_preview', size: '1024x1024' or aspect-mapped, quality: 'medium', ... })`.
- Returns: `{ ok: true, render_id, asset_id, public_url }`.

### `POST /api/preview/approve`
- Body: `{ session_id, asset_id }`. Locks `combination_preview_asset_id`. Stage 3 complete.
- Returns: `{ ok: true }`.

## Server Actions (non-vendor writes)

Pure DB writes invoked from form components — no Route Handler needed:
- Intake field saves (1.6 memory prompt, 1.7 gender, 1.8 relationship, 1.9/1.10 traits/favorites, 1.11 creator name, 1.12 years) — all go through one Server Action `saveIntakeField(sessionId, field, value)` which delegates to a PATCH equivalent.
- Stage 3 pill picks (format/theme/style) same pattern via `setStage3Choice`.

## Rate limits

Per-session: 1 in-flight render. 20 renders/hour. Hard cap $10/session (read from `renders.cost_usd_est` sum) — exceeded → 429 with body `{ ok: false, error: 'session-budget-exceeded' }` and an email to Xee.
Per-IP (middleware): 60 req/min across all `/api/*` routes.

## Error envelope reference

```ts
{ ok: false, error: 'invalid-input', issues: ZodIssue[] }       // 400
{ ok: false, error: 'cookie-mismatch' }                          // 403
{ ok: false, error: 'session-not-found' }                        // 404
{ ok: false, error: 'invalid-stage-transition', from, to }       // 400
{ ok: false, error: 'payload-too-large', bytes? | count? }       // 413 (file size / URL count over limit)
{ ok: false, error: 'too-many-photos', limit, current? }         // 413 (per-session 10-photo cap)
{ ok: false, error: 'render-in-flight' }                         // 409, Retry-After header
{ ok: false, error: 'session-budget-exceeded' }                  // 429
{ ok: false, error: 'rate-limited' }                             // 429 (per-IP, from src/proxy.ts), Retry-After header
{ ok: false, error: 'render_failed', attempts: VendorAttempt[] } // 502 (both vendors failed)
{ ok: false, error: 'content-policy-violation' }                 // 422 (vendor rejected prompt)
```
