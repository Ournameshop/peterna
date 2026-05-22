# Phase 15 — Personalization + Continuity + Music (plan)

**Owner / agent type:** Architect → Backend (primary) + Frontend (Stage 1.2 + Stage 5.5 UX).
**Prerequisites:** `architecture.md`, `vendor-layer.md`, `data-model.md`, `phase-plan.md`. Phase 7 (Seedance) and Phase 5 (Words) must already be live on `v3-zeeshan` — Phase 15 layers onto them.

## Executive summary

Three interlocking upgrades, all aimed at one outcome: the tribute should *feel like the user's specific pet, in their specific world, with a song made for them* — not a stock-music slideshow with a generic-looking dog. (1) **Photo strategy:** split the single `pet_photo` bucket into three typed roles so the character sheet stops being polluted by with-human shots and so memory beats can be seeded from a real photo of pet+person. (2) **Video continuity:** chain Seedance clips by feeding clip N's last frame into clip N+1 as `image_url`, with a hard re-seed every 4 clips back to the storyboard frame to bound likeness drift. (3) **Suno music:** add a new `generate_music` capability that composes a personalized song from session context; library tracks stay as a fallback for users who don't want to wait 60s. Ship in that order — photos is intake-only and cheapest; Suno touches intake + assembly; continuity is the most invasive (worker + ffprobe + dependency chain) and ships last.

---

## 1. Photo strategy

### Decision

Add a **typed photo role** to every uploaded/ingested asset, surface it as a three-step intake at Stage 1.2, and route each role to a different downstream consumer.

### Schema change

**Pick: `assets.metadata.photo_role`** (jsonb), not a top-level column.

- `assets.metadata` is already a `jsonb` column (`src/lib/db/schema.ts:212`) and already carries vendor-specific fields. Adding `photo_role: 'character_reference' | 'with_human' | 'environment'` is a zero-migration change for any existing row (we treat missing as `'character_reference'` for back-compat).
- A top-level column would be queryable via index, but the only queries we run are "give me all photos for session X" — we already scan to that — and the cinematography selection rule lives in app code. The migration cost (column add, backfill, wire-type churn) buys us nothing here.
- **Tradeoff accepted:** can't add a Postgres `CHECK` constraint on the enum values; instead we validate in `src/lib/builder/wire-types.ts` at insert + serialize boundaries (same way `kind` is already gate-checked).

Backfill: in `src/app/api/upload/route.ts` and `src/app/api/ingest-url/route.ts`, accept a new field `photo_role` on the request body; default to `'character_reference'` when absent.

### Asset kind unchanged

`assets.kind` stays `'pet_photo'` for all three roles. We are not splitting on kind because S3 layout, retention, and the asset-resolve helpers don't care about the role — only the prompt builders and the cinematography engine do. One concept per column.

### UX — Stage 1.2 becomes a three-step micro-flow

State machine adds three sub-stages between the current `intake_photos` and the next state (`intake_pet_name`-or-equivalent). Each reuses `PhotoUrlField` with a new `role` prop, new copy block, and a per-role minimum.

| Sub-stage | Role | Copy header | Min | Max | Skippable? |
|---|---|---|---|---|---|
| `intake_photos_alone` | `character_reference` | "Photos of [PET_NAME] alone" | 3 (soft, warn but allow 1+) | 10 | No (Stage 2 needs likeness) |
| `intake_photos_with_human` | `with_human` | "Photos of [PET_NAME] with their people" | 0 | 5 | Yes |
| `intake_photos_environment` | `environment` | "Their favorite places" | 0 | 3 | Yes |

`src/components/builder/PhotoUrlField.tsx`:
- Add `role: PhotoRole` prop. Forward to `/api/upload` and `/api/ingest-url` so the server stamps `metadata.photo_role`.
- The `variant: 'first' | 'followup'` switch stays; introduce `variant: 'with_human' | 'environment'` for the two new sub-stages so copy + minimums + the optional "skip" pill are rendered correctly.

`src/lib/library/copy.ts` additions (add to the `PHOTO_PROMPT` block at line 112):
- `header_with_human`, `question_with_human`, `skip_with_human`
- `header_environment`, `question_environment`, `skip_environment`
- A new shared `role_explainer` paragraph that appears under each header, one-sentence-each, explaining *why* we're asking ("These help us animate moments of you together — we won't reshape their face, just use the photo as a starting frame.").

Anti-trauma constraint (Stage 3.5: no human faces): the `with_human` photos are **never** used as image-to-image reference for the GPT-Image-2 character sheet or storyboard renders. They are **only** passed to Seedance image-to-video as the `image_url` seed, where Seedance animates the existing photo rather than re-synthesizing the human face. This matches how the spec uses storyboard frames today — Seedance treats the input image as canonical and applies motion, not identity replacement. We MUST add a unit test in `build-character-sheet.ts` asserting `with_human` URLs are filtered out before reference passing.

### Beat-to-photo mapping rule

In `src/lib/cinematography/derive-motion-brief.ts` (or a new sibling `src/lib/cinematography/pick-seed-photo.ts` if we want it pure and testable), introduce a selector:

```
pickSeedPhotoFor(beat, allPhotos) →
  if beat.archetype ∈ {'peak_warmth', 'companionship', 'turning'} AND with_human photos exist
    → return one with_human photo, round-robin across these beats
  else if beat.archetype ∈ {'opening', 'closing', 'descent'} AND environment photos exist
    → return one environment photo (preferred for establishing shots)
  else
    → return null (caller falls back to the rendered storyboard frame)
```

The selector returns an *override* for the storyboard frame URL on these specific beats only. The storyboard frame is still rendered (we still want the character sheet to inform downstream visuals); the override lives at the Stage 6 video-clip step. This keeps the chain simple: storyboard generation doesn't change at all.

### Prompt-builder changes

- **`src/lib/prompts/build-character-sheet.ts:122-126`** — currently maps `photoUrls` 1:1 to `references`. Change `BuildCharacterSheetInput.photoUrls` to receive only the `character_reference` role; the caller (`src/app/api/character-sheet/render/route.ts`) filters at the resolve step. Add an assertion: if `photoUrls.length === 0` after filtering, route returns 400 with copy "We need at least one photo of [PET_NAME] alone for this step" — surfaces the soft warning instead of silently rendering off whatever's available.
- **`src/lib/prompts/build-video-clip.ts:73,127`** — extend `BuildVideoClipInput` with optional `seedPhotoOverrideUrl?: string`. When present, the output's `imageUrl` is the override; the storyboard frame stays referenced inside the prompt body as a likeness anchor sentence ("Maintain the look established in the reference frame"). The override only fires when the cinematography engine emits one; archetype-driven only, never user-toggled.

### Asset row shape — final

```
assets (
  ...,
  metadata jsonb,   -- now includes { photo_role: 'character_reference'|'with_human'|'environment', ... }
);
```

No migration. Backfill via app-code default. Document in `data-model.md` § "Library data" addendum.

---

## 2. Video continuity (last-frame chaining)

### Decision

Chain clips by extracting the **last frame of clip N** to S3 as a `'clip_last_frame'` asset, then using it as Seedance's `image_url` for clip N+1. Re-anchor to the storyboard frame every 4 clips (or whenever the beat archetype changes from a "memory" archetype to a "transcendent" archetype) to bound likeness drift.

### Verified vendor capability

Confirmed via fal.ai docs (`bytedance/seedance-2.0/image-to-video`): the endpoint accepts `image_url` (start frame) and an optional `end_image_url` (end frame). Crucially, **any image URL is accepted as `image_url`** — there is no special "continuation" mode. Feeding the last frame of a previously rendered clip as the next clip's `image_url` is mechanically supported (search-verified, OpusClip and Seedance docs both describe this exact chaining workflow). The tradeoff is documented elsewhere: each chained generation re-encodes through the model, so visual quality drifts gradually after ~3–5 hops if the seed isn't periodically reset to a known-good likeness anchor.

### Pipeline change

After `generateVideo()` succeeds and the MP4 has been rehosted to S3, run ffmpeg to dump the **last full frame** as a PNG, upload to S3, and persist as a new asset row. This runs synchronously inside the worker — extracting a single PNG from a 15s MP4 is ~200ms; not worth a separate job.

Add to `src/lib/queue/worker.ts::runVideoClipJob` after line 256 (insertion of the `video_clip` asset row):

1. Read the MP4 bytes from S3 (or, better, keep them in memory after stitching — pass through from `generateVideo`).
2. `ffmpeg -sseof -0.1 -i clip.mp4 -update 1 -q:v 2 -frames:v 1 last.png` (seek to 100ms before end-of-file, extract one frame).
3. Upload to `sessions/<id>/frames/<uuid>.png`.
4. Insert assets row with `kind='clip_last_frame'`, `metadata = { beat_idx, source_clip_asset_id }`.
5. Persist on the session row: extend the array `clip_last_frame_asset_ids text[]` parallel to `video_clip_asset_ids` so beat N+1 can look up beat N's last frame in O(1).

**Why ffmpeg, not ffprobe:** ffprobe doesn't extract — it inspects. We already have ffmpeg on the worker box (assembly step at `src/lib/assembly/stitch.ts`). One dependency, used for both.

### Worker ordering — sequential by beat_idx

Today, `video_clip` jobs are independent and the worker pool can claim them in parallel. To chain, beat N+1's job must wait for beat N to finish.

**Pick: enforce sequential claim by beat_idx in `claimNextJob`**, not BullMQ-style explicit `dependsOn`. Two reasons:

1. We already have a Postgres-as-queue (`renderJobs` table); we don't have BullMQ. Adding a dependency-graph layer is significantly more code than a `WHERE` clause filter.
2. The dependency is fully linear and known at enqueue time — there's no DAG, just a chain.

Concretely: extend `claimNextJob` (in `src/lib/queue/claim.ts`) to skip a `video_clip` row whose payload has `beat_idx > 0` if the same session has no `done` row at `beat_idx - 1` yet. SQL sketch:

```
SELECT … FROM render_jobs j
WHERE j.status = 'queued'
  AND (
    j.kind <> 'video_clip'
    OR (j.payload->>'beat_idx')::int = 0
    OR EXISTS (
      SELECT 1 FROM render_jobs prev
      WHERE prev.session_id = j.session_id
        AND prev.kind = 'video_clip'
        AND (prev.payload->>'beat_idx')::int = (j.payload->>'beat_idx')::int - 1
        AND prev.status = 'done'
    )
  )
ORDER BY j.created_at
FOR UPDATE SKIP LOCKED LIMIT 1;
```

**Tradeoff accepted:**
- (+) Parallelism collapses to 1 worker per tribute. Throughput per worker drops; an N-worker pool used to render N clips of one tribute in parallel; now it can only render 1 clip of that tribute at a time. **Other tributes still parallelize across workers** — only the in-tribute parallelism is gone.
- (+) Linear chain matches the user-visible storytelling — the tribute reads as one continuous piece of footage, not N independent cuts.
- (−) Total render wall-clock for a single tribute grows from ~max(clip_durations) to ~sum(clip_durations). For an 8-beat tribute at ~45s per clip render, that's ~6 minutes instead of ~45s. The "your tribute is being made" copy at delivery needs to set the expectation.
- (−) Job failures cascade — if clip N fails, all of N+1..N+M cannot start. The existing "reroll clip" flow handles this: the user rerolls clip N, which re-enqueues, and the chain resumes. Document this in `risk-register.md`.

### Drift mitigation — re-seed every 4 clips

In `pickSeedPhotoFor` (the same selector from §1), add a third rule that fires **before** the with_human / environment rules:

```
if beat_idx === 0
  → use storyboard_frame[0] (the canonical anchor — same as today)
if beat_idx % 4 === 0
  → use storyboard_frame[beat_idx] (re-anchor every 4 clips to the beat's own storyboard frame)
if (with_human or environment override fires per §1)
  → use override
else
  → use clip_last_frame[beat_idx - 1]
```

The 4-clip cadence is a starting heuristic. Add session-row metadata field `cinematography_continuity_log jsonb` recording which strategy fired per beat, so we can audit drift after first 10 real tributes and tune the cadence (or trigger it on archetype-transition instead of fixed N).

**Tradeoff:** every 4th clip will have a visible "feel break" — it cuts from the chained-drift world back to the storyboard frame. This is by design — we'd rather have a small editorial cut every 4 beats than a steady drift away from the user's pet's likeness across 16 clips. The cuts also align naturally with beat-sheet act breaks if the beat sheet is structured in 4-beat acts (it usually is).

### Prompt change

`src/lib/prompts/build-video-clip.ts` — add a one-line context sentence when the seed is a `clip_last_frame` (not a fresh storyboard frame):

```
"Continue smoothly from the start frame. Maintain visual continuity — same pet, same lighting, same world. Do not introduce new elements; let the existing scene breathe and evolve."
```

This goes between the likeness-reference sentence and the beat block. Conditional in the builder.

### Spec doc updates

- `docs/tribute-builder/vendor-layer.md` — add a Phase-7 § "Frame continuity" describing the chain + re-anchor cadence + the new `clip_last_frame` asset kind.
- `docs/tribute-builder/data-model.md` — add `clip_last_frame` to the enumerated `assets.kind` values; add `sessions.clip_last_frame_asset_ids text[]` and `sessions.cinematography_continuity_log jsonb` fields with one-line descriptions.

---

## 3. Suno music integration

### Decision

Add a new `generateMusic()` capability to `src/lib/ai/`. Suno is the sole vendor for music (matches the Seedance sole-vendor pattern, Risk #4). Library tracks at `src/lib/library/music-tracks.ts` remain as a free, instant tertiary option for users who don't want to wait. Default offered choice is "Compose a personalized song" — that's the heart-touching path.

### Vendor & endpoint — verified

Suno does not publish an official end-user API in 2026. Multiple third-party gateways (kie.ai, docs.sunoapi.org, PiAPI, sunoapi.org) operate account pools and expose a clean REST surface. Verified endpoint shape (kie.ai, the most coherent docs):

- **POST** `https://api.kie.ai/api/v1/generate`
- Body: `{ prompt, customMode, instrumental, model: 'V5' | 'V5_5' | …, callBackUrl, style?, title?, vocalGender?, negativeTags?, … }`
- Returns: `202 { code: 200, data: { taskId } }` — **async**, callback-driven, three callback stages (`text`, `first`, `complete`). No synchronous polling endpoint in v1 — must implement a webhook receiver.
- No `duration` parameter — songs are generated at the model's native length (~3–4 min) and trimmed/looped at assembly time.

**Pick: kie.ai gateway** (their docs are the cleanest; pricing model is credit-based and they offer V5/V5.5 — Suno's latest at this writing). Add an env var `SUNO_API_KEY` (their key) and `SUNO_GATEWAY_BASE_URL` (defaults to `https://api.kie.ai/api/v1`) so we can swap providers without code changes.

**Tradeoff accepted:**
- (+) Working API surface today; no waiting for Suno to ship official self-serve.
- (−) Account-pool gateway = single point of failure outside our control. If kie.ai goes down, music gen is unavailable for the duration. The library-track fallback (already implemented) becomes the safety net.
- (−) No SLA. Mitigate by treating Suno failures the same way we treat assembly failures: the tribute still ships, just without composed music — the user can re-trigger or fall back to library.

### Capability shape

```
src/lib/ai/generate-music.ts
  export type GenerateMusicInput = {
    prompt: string;                 // composed by build-music-prompt.ts
    style: string;                  // 1–2 word genre tag, e.g. "warm acoustic folk"
    title: string;                  // e.g. "For Bella" — appears in MP3 metadata
    instrumental: boolean;          // default false; user-controllable
    model: 'V5' | 'V5_5';           // pin V5_5
    sessionId: string;
    idempotencyKey: string;
  };

  export type GenerateMusicResult = {
    url: string;                    // S3-rehosted MP3 public URL
    durationSeconds: number;        // probed via ffprobe after rehost
    vendorServed: 'suno';
    costUsdEst: number;
    durationMs: number;
  };
```

Hybrid policy: Suno only, no fallback at the capability layer. Library-track fallback lives one level up (the Stage 5.5 UX), not in `generate-music.ts`.

Timeout: 90s for the gateway to return a `complete` callback URL. (Generation takes 30–60s; allow headroom.) If timeout fires, the route handler logs failure and the UI offers "Try again" or "Pick a library track instead."

### Prompt composition

New `src/lib/prompts/build-music-prompt.ts`:

```
buildMusicPrompt({ session, beatSheet, theme, format }) → {
  prompt:
    "A {moodPhrase} song for {pet_name}, {pet_gender} {species} who {memoryClause}. " +
    "{traitsClause}. {favoritesClause}. " +
    "Style: {styleClause}. Mood arc follows the tribute — open tender, " +
    "build to peak warmth around 90 seconds, soften to dignified closing.",
  style: pickStyleString(format, theme),   // e.g. "warm acoustic folk, fingerpicked guitar, soft piano"
  title: "For " + pet_name,
}
```

- `moodPhrase` derived from `theme.emotional_register` (`tender` / `celebratory` / `reflective` / `transcendent`) and format (`send_off` → "tender farewell", `forever_young` → "joyful, hopeful celebration").
- `memoryClause` is one sentence pulled from `memory_prompt_answer`, sanitized (strip PII, cap at 120 chars). This is the personalization hook — the song will literally be about *this specific pet*.
- `traitsClause` and `favoritesClause` convert `personality_traits[]` and `favorite_things[]` into musical-vocabulary fragments ("playful and curious" → "bouncing, light melodic figures"; "loved the beach" → "with sea-breeze warmth").
- The Suno style string is short and dense — see Suno docs: 200–1000 chars depending on model.

Lyrics: `instrumental: false` by default. The Suno model will generate lyrics that incorporate the pet's name (Suno honors proper nouns in the prompt). We do not pre-compose lyrics — Suno's own lyrics engine is the load-bearing piece. **Risk:** Suno occasionally generates awkward or inappropriate lyrics ("died" / "passed away"). Mitigate via `negativeTags: 'death, dying, sad, mournful'` per Suno's content controls + a regenerate budget of 3 attempts per session before falling back to instrumental or library.

### DB changes

```
sessions:
  composedMusicAssetId  uuid              -- references assets(id), null until Suno completes
  composedMusicStatus   text              -- 'idle' | 'queued' | 'generating' | 'done' | 'failed'
  composedMusicAttempts integer default 0 -- 3-attempt budget
```

The existing `musicTrackId text` stays — the user's *final pick* (library track id, "compose", or "silence") flows through this column. New convention: `musicTrackId = 'composed'` means "use `composedMusicAssetId`"; `'silence'` means no music; anything else is a library track id.

```
assets:
  kind = 'composed_music'   -- new value; metadata = { suno_task_id, vendor: 'suno', model, prompt, duration_s }
```

### Route + job flow

1. **User chooses "Compose a song" at Stage 5.5** → `POST /api/music/compose` with session_id + idempotency_key. Route:
   - Validates session is in the right stage; budget check on `composedMusicAttempts < 3`.
   - Builds the music prompt server-side (no client-supplied prompt).
   - Enqueues a `render_jobs` row with `kind='compose_music'`.
   - Sets `composedMusicStatus = 'queued'`. Returns immediately.
2. **Worker handles `compose_music`:**
   - Calls `generateMusic()`.
   - Suno's gateway returns a `taskId`; worker stores it on a transient row (or in the job's `payload`) and **registers a webhook callback** at `POST /api/webhooks/suno?sessionId=…&jobId=…`.
   - Worker marks job `running` and exits — the job is async, the callback resumes it. (Pattern is novel for us; today everything is synchronous-in-worker. See "Tradeoff" below.)
3. **Webhook handler `/api/webhooks/suno`:**
   - Verifies `X-Suno-Signature` (HMAC of body with `SUNO_WEBHOOK_SECRET`).
   - On `complete` stage: downloads the MP3, rehosts to S3 at `sessions/<id>/music/<uuid>.mp3`, inserts `assets` row with `kind='composed_music'`, updates `sessions.composedMusicAssetId` + `composedMusicStatus = 'done'`, and marks the job `done`.
   - On `failed`: increments `composedMusicAttempts`, marks job failed, leaves status `'failed'`. UI offers retry.
4. **Assembly fetches `composedMusicAssetId`:** modify `src/lib/queue/worker.ts::runAssemblyJob` around line 355 — the existing `findMusicTrack` block becomes:
   - If `composedMusicStatus === 'done'` and `composedMusicAssetId` set → fetch that asset's MP3 bytes and pass to `stitchTribute({ musicBuffer })`.
   - Else if `musicTrackId` is a library track → existing path.
   - Else silence.
   - `stitchTribute` already accepts a `musicBuffer: Buffer | null`; the actual ffmpeg mix in `src/lib/assembly/stitch.ts` needs verification but should already handle this path (currently passes `null` per line 378 — i.e. assembly is silent today regardless of library pick, which is a pre-existing bug worth surfacing separately).

**Tradeoff accepted (webhook pattern):** Suno is the first capability we have that *requires* a callback rather than fitting our long-poll-then-return model. Two options were considered:

1. **Webhook + status-row hand-off (recommended).** Worker enqueues the Suno job and returns immediately; the webhook receiver resumes by writing the asset row. Pro: matches Suno's actual API. Con: introduces a new async pattern; we must operate a publicly reachable webhook URL with HMAC verification.
2. **Poll the gateway every 5s from the worker.** Pro: zero new infrastructure. Con: ties up a worker slot for 30–60s per song, can starve video clip jobs.

I pick (1) because we already have render_jobs as the transactional unit-of-work — the webhook just transitions the job's status. And we already operate an HTTPS surface (the app). The HMAC envelope is one helper.

### Cost

Suno gateways quote ~$0.05–$0.15 per generated track depending on model + provider. Lock V5_5 and budget $0.15 / song for the cost-impact table. Three attempts max = $0.45 ceiling on the music-gen line item per session.

### Stage 5.5 UX

`src/components/builder/WordsEditor.tsx` (the music picker today): re-shuffle the section into three options, in this order:

1. **"Compose a song for [PET_NAME]"** — primary. Big card. Copy: "We'll write and produce a one-of-a-kind song using their name and the memories you shared. Takes about a minute." Submit button: "Compose their song". On submit, fires `POST /api/music/compose` and shows a small in-line "writing…" → "producing…" → "almost there…" progression driven by polling `GET /api/session/[id]` for `composedMusicStatus`.
2. **"Pick from our library"** — collapsed accordion. The current 9 tracks live here.
3. **"No music"** — small text link at the bottom. ("Let the ambient sound carry it.")

Skip preview/playback affordance: once Suno completes, the WordsEditor shows the generated MP3 with an audio player and a "Regenerate" button (consumes one of the 3 attempts). User must click "Use this song" to lock — same pattern as character-sheet approval.

---

## Cross-cutting changes

### DB migration

One new migration file (Drizzle): `drizzle/0015_phase15_personalization.sql`

- `ALTER TABLE sessions ADD COLUMN composed_music_asset_id uuid REFERENCES assets(id);`
- `ALTER TABLE sessions ADD COLUMN composed_music_status text;`
- `ALTER TABLE sessions ADD COLUMN composed_music_attempts integer NOT NULL DEFAULT 0;`
- `ALTER TABLE sessions ADD COLUMN clip_last_frame_asset_ids text[];`
- `ALTER TABLE sessions ADD COLUMN cinematography_continuity_log jsonb;`

No changes to `assets` or `renders` tables — new `kind` and `metadata` values are application-layer enums.

### Env vars

| Var | Purpose | Required from |
|---|---|---|
| `SUNO_API_KEY` | kie.ai gateway key | Phase 15 |
| `SUNO_GATEWAY_BASE_URL` | gateway URL (defaults to `https://api.kie.ai/api/v1`) | Phase 15 |
| `SUNO_WEBHOOK_SECRET` | HMAC for `/api/webhooks/suno` | Phase 15 |

Document in `vendor-layer.md` § "Env vars" alongside the existing `OPENAI_API_KEY` / `FAL_KEY` table.

### Library additions

- `src/lib/library/copy.ts` — new keys per §1 UX table + new `MUSIC_COMPOSE_PROMPT` block (the verbatim copy for the three Stage 5.5 options).
- `src/lib/library/music-styles.ts` (new) — a small lookup of `{format_id, theme_id} → suno_style_string` so the music-prompt builder is deterministic and unit-testable. ~30 entries; same shape as `art-styles.ts`.

### New files (Backend agent)

- `src/lib/ai/generate-music.ts` — capability.
- `src/lib/ai/vendors/suno.ts` — raw kie.ai gateway client.
- `src/lib/prompts/build-music-prompt.ts` — pure prompt composer.
- `src/lib/cinematography/pick-seed-photo.ts` — pure photo selector.
- `src/lib/video/extract-last-frame.ts` — ffmpeg wrapper, pure-ish (filesystem temp file).
- `src/app/api/music/compose/route.ts` — enqueues compose_music job.
- `src/app/api/webhooks/suno/route.ts` — receives Suno callbacks.

### Modified files (Backend agent)

- `src/lib/db/schema.ts` — five new columns (see migration).
- `src/lib/builder/wire-types.ts` — `SessionWire` + `AssetWire` extended; `PhotoRole` enum; new `AssetKind` value `'composed_music'` + `'clip_last_frame'`.
- `src/lib/builder/serialize.ts` — surface new columns.
- `src/lib/queue/claim.ts` — sequential beat ordering filter.
- `src/lib/queue/worker.ts` — `runVideoClipJob` extends with last-frame extraction; new `runComposeMusicJob` handler; `runAssemblyJob` reads composed music first.
- `src/lib/prompts/build-character-sheet.ts` — filter references to `character_reference` role only.
- `src/lib/prompts/build-video-clip.ts` — accept seed-photo override; conditional continuity-prompt sentence.
- `src/app/api/upload/route.ts`, `src/app/api/ingest-url/route.ts` — accept + persist `photo_role`.
- `src/app/api/character-sheet/render/route.ts` — filter photos by role before calling builder.

### Modified files (Frontend agent)

- `src/components/builder/PhotoUrlField.tsx` — `role` + extended variant props.
- `src/components/builder/WordsEditor.tsx` — three-option music section.
- `src/lib/builder/state.ts` — three new sub-stages between `intake_photos` and the next state.
- `src/app/builder/[...wizard]` — add the new sub-stage screens (intake_photos_with_human, intake_photos_environment).

---

## Cost impact

Per-tribute total under Phase 15 (8-beat tribute, defaults):

| Line | Today | Phase 15 |
|---|---|---|
| Vision pass | $0.005 | $0.005 |
| Character sheet (1 + ~4 refinements) | $2.00 | $2.00 |
| Combination preview (1–3) | $0.10 | $0.10 |
| Storyboard frames (8 × $0.20) | $1.60 | $1.60 |
| Card previews (3 × $0.20) | $0.60 | $0.60 |
| Video clips (8 × $0.50) | $4.00 | $4.00 |
| **Clip last-frame extraction** | — | **$0.00** (ffmpeg local) |
| **Suno music (default × 1, up to 3 attempts)** | — | **$0.15** ($0.45 ceiling) |
| **S3 + bandwidth** | ~$0.05 | ~$0.06 (last-frame PNGs add ~5MB/tribute) |
| **TOTAL (typical)** | ~$8.36 | ~$8.51 |
| **TOTAL (worst case music)** | — | ~$8.81 |

Phase 15 adds ~$0.15 typical / ~$0.45 worst-case per tribute. Storage and S3 cost is negligible vs. the marginal gain in personalization.

---

## Implementation phasing

Ordered smallest-first / value-per-build.

1. **Phase 15a — Photo roles (intake-only).** Schema-free (metadata jsonb), no worker changes, no Suno, no continuity. Backend ~1.5 days, Frontend ~1 day. Ships behind a feature flag `PHASE_15A_ENABLED=true`. **User-visible value: character sheet stops being polluted by with-human photos; existing sessions unaffected.**
2. **Phase 15b — Suno music integration.** New capability, new route, new webhook, Stage 5.5 UX rework. Backend ~3 days (capability + webhook is the most novel piece), Frontend ~1.5 days. Library track fallback kept intact. **User-visible value: heart-touching personalized song.**
3. **Phase 15c — Video continuity chaining.** Worker re-ordering, ffmpeg last-frame extraction, drift mitigation, observability. Backend ~3 days; the trickiest piece is the queue ordering (claim filter + fallback testing for partial failures). **User-visible value: tribute feels like one continuous piece of footage instead of N independent cuts.**

Each phase ships independently and is reversible by feature flag. Recommend Phase 15a in the next sprint, 15b the sprint after, 15c only after we've shipped 15b and observed real-tribute drift in production (the drift cadence is a tuning parameter that benefits from real data).

---

## Open questions for Xee

1. **Suno gateway choice — kie.ai vs. PiAPI vs. sunoapi.org.** I picked kie.ai for docs quality; you may have a preference based on prior account or pricing. Confirm before backend implements.
2. **Suno API key gate.** Do we have a Suno gateway account provisioned? If not, this needs to happen *before* Phase 15b backend starts. (You can sign up at kie.ai — they're credit-prepaid; $20 buys ~150 songs.)
3. **Anti-trauma rule + human faces.** The spec's "no humans in frame" rule (Stage 3.5) was written for *generated* humans where the model invents/distorts a face. For `with_human` photos passed to Seedance image-to-video, the human's face exists in the source photo — Seedance animates it (eye blink, head turn) rather than re-synthesizing it. **Recommend: explicit rule = `with_human` photos may be USED as image-to-video seeds; they may NEVER be passed as character-sheet / storyboard references.** Confirm.
4. **Drift cadence.** I picked every 4 clips as the re-anchor cadence. Two alternative anchors worth considering: (a) re-anchor on every archetype transition (`peak → descent`); (b) let the cinematography engine decide based on the consistency-pass output. Recommend ship with fixed N=4 in 15c, instrument with `cinematography_continuity_log`, tune after first 10 real tributes.
5. **Webhook public URL.** Production deploy target is still TBD (architecture.md open question #3). The Suno webhook needs a stable HTTPS endpoint. If we're not deployed yet by 15b, we can use a tunneling service (Cloudflare Tunnel, ngrok) for dev — but launch requires a real domain. Tie this to the deploy-target decision.
6. **Music regeneration UX.** I picked "3-attempt budget per session" — is that the right number? If a user really hates the first take, do we want unlimited rerolls (at $0.15 each) or a hard cap?
7. **Pre-existing music gap.** Current code (`src/lib/queue/worker.ts:378`) passes `musicBuffer: null` to `stitchTribute` regardless of `musicTrackId` — i.e. library tracks aren't actually mixed in today. Phase 15b will wire composed music through; should we also fix library-track mixing as part of the same phase? Recommend yes — same code path, marginal extra work.

---

## Risk additions (append to `risk-register.md`)

### 6. Likeness drift across chained Seedance clips — MEDIUM

**Risk:** Each chained image-to-video generation accumulates small visual changes. After 5+ chained clips the pet may look subtly different from the user's reference photos. Likeness is the spec's named critical failure mode (Risk #1).

**Likelihood:** Certain to occur in some form on every multi-act tribute; severity depends on the rate of drift.

**Mitigation:** Periodic re-anchor to the storyboard frame every 4 clips. Log per-beat seed strategy to `sessions.cinematography_continuity_log` for post-hoc tuning. If drift exceeds 30% user-noted on first 10 tributes, drop cadence to 3 or trigger on archetype transition instead.

### 7. Suno gateway dependency — MEDIUM-HIGH

**Risk:** Suno does not offer official API in 2026; we depend on third-party account-pool gateway (kie.ai). Gateway outage = music gen unavailable. No SLA.

**Likelihood:** Low-moderate; account-pool services historically have multi-hour outages 1–2× per quarter.

**Mitigation:** Library music track fallback stays as Stage 5.5 secondary option (already in place). UI gracefully degrades to "Music is taking a moment — try a library track for now?" if Suno fails after 3 attempts.

### 8. Suno lyrical content quality — MEDIUM

**Risk:** Suno may generate inappropriate or awkward lyrics (e.g., overly funereal language for a memorial tribute, mentions of death, generic placeholder names instead of the pet's name).

**Likelihood:** Real; Suno's content controls help but don't eliminate.

**Mitigation:** `negativeTags: 'death, dying, sad, mournful'` on every request. 3-attempt regenerate budget. User auditions the song and explicitly clicks "Use this song" before assembly — so a bad take never ships silently.

### 9. Sequential worker chain bottleneck — LOW-MEDIUM

**Risk:** Forcing beat_idx ordering serializes per-tribute video gen, growing wall-clock from ~max(clip render) to ~sum(clip renders). User waits ~6 minutes instead of ~45s for an 8-beat tribute.

**Mitigation:** Set the right user expectation in the "your tribute is being made" copy. Push notification on completion already exists (Phase 12). Cross-tribute parallelism is unaffected — N workers still process N concurrent sessions.

