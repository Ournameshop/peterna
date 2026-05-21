# API routes — Phase 1 surface (Stages 1–3)

**Owner / agent type:** Backend (route handlers).
**Prerequisites:** read `vendor-layer.md` and `data-model.md` first.

## Conventions

- All under `src/app/api/`. All `export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'`. Long-running routes: `export const maxDuration = 90`.
- Response envelope: `{ ok: true, ...data }` on success; `{ ok: false, error: <kebab-string>, ...details }` on failure. Mirrors the existing `feat/lead-emails-smtp:src/app/api/lead/route.ts` pattern.
- Auth: HMAC-signed cookie. Every route except `session/create` and `session/[id]` GET-via-resume-token requires the cookie match.
- Idempotency: render routes accept `Idempotency-Key` header (UUID v7); unique on `renders(session_id, stage, idempotency_key)`. Duplicate within 60s short-circuits to the existing row.

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
- Body: partial session fields (`pet_name`, `pet_gender`, `relationship`, `personality_traits[]`, `favorite_things[]`, `creator_name`, `years_label`, `beat_count`, `target_minutes`, `aspect_ratio`, `curators_pick_id`, `format_id`, `theme_id`, `style_id`).
- Returns: updated session JSON.
- Server validates `stage` transition against the builder state-machine reducer in `src/lib/builder/state.ts`. Illegal skip-ahead → 400 `{ ok: false, error: 'invalid-stage-transition' }`.

### `DELETE /api/session/[id]`
- Cascades: DB rows deleted, R2 `DeleteObjects` called for all assets.
- Returns: `{ ok: true }`.

### `POST /api/upload`
- Multipart form: `file` (image/*) + `session_id`.
- Streams to R2 at `sessions/<id>/photos/<uuid>.<ext>`. Inserts `assets` row with `kind='pet_photo'`, `source='upload'`.
- Returns: `{ ok: true, asset_id, public_url }`.
- Limits: 10 MB per file, 10 files per session. 413 on overflow.

### `POST /api/ingest-url`
- Body: `{ session_id, urls: string[] }` (max 10)
- For each URL: normalize (Drive `view` → `uc?export=download&id=...`; Dropbox `?dl=0` → `?dl=1`), HEAD-check (require `Content-Type: image/*`), download server-side, rehost to R2.
- Returns: `{ ok: true, assets: Array<{ asset_id, public_url }>, failed: Array<{ url, reason }> }`.

### `POST /api/vision-pass`
- Body: `{ session_id }`. Server reads `pet_photos[]` (all asset rows with `kind='pet_photo'`).
- Calls `runVisionPass({ photos, schema: petProfileSchema, sessionId })`.
- On success: persists `inferred_profile` + `inferred_confidence` to session, returns `{ ok: true, inferred_profile, confidence }`.
- On `AIError`: returns `{ ok: true, vision_failure: true }` (200 — the failure path is a UX state, not a transport error). UI degrades to v0.7 explicit-question flow.

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
{ ok: false, error: 'render-in-flight' }                         // 409, Retry-After header
{ ok: false, error: 'session-budget-exceeded' }                  // 429
{ ok: false, error: 'render_failed', attempts: VendorAttempt[] } // 502 (both vendors failed)
{ ok: false, error: 'content-policy-violation' }                 // 422 (vendor rejected prompt)
```
