# Changelog

Notable changes to the Peternal tribute builder (`/builder`). Newest first.
Working branch: `Adding-skill-in-webflow`.

## 2026-05-22

### Likeness — photo-led character-sheet prompt (`50a4cbd`)
Rewrote the character-sheet generation prompt: removed the breed name and
front-loaded the reference photos as the source of truth, with an explicit
ban on generic / stereotypical breed output. Naming the breed was making the
model produce a textbook breed example instead of the actual pet.

### Image generation moved to Gemini (`b41069d`)
The fal.ai account ran out of balance (403 — "user is locked, exhausted
balance"). Rewired `/api/image/edit` from fal `openai/gpt-image-2` to
Gemini 2.5 Flash Image (reference-conditioned), returning a `data:` URL.
`/api/card/render` now returns the card PNG as a `data:` URL instead of
uploading to fal.storage. Character sheet, storyboard frames, combination
preview and cards no longer need fal credits.
NOTE: likeness fidelity is weaker than fal `gpt-image-2` — see Known Issues.

### resvg native module → WASM (`4c65d05`)
`@resvg/resvg-js` (native) crashed under the Turbopack production build
("Cannot find module @resvg/resvg-js-<hash>" — worked in dev, failed in
`next start`). Switched to `@resvg/resvg-wasm`; fonts now passed as buffers.

### Suno music integration
Added `src/lib/suno.ts` (sunoapi.org). `/api/video/music` now uses Suno as
the primary instrumental music-bed generator, with fal ElevenLabs as a
fallback. `SUNO_API_KEY` added to env.

### Staging deployment
SSH access established. Staging actually runs under the `zeeshan` user
(PM2 app `peterna-staging`, port 3008, `/home/zeeshan/apps/peterna-staging`).
The server `.env` had the 3 API key names but EMPTY values — populated
`FAL_KEY`, `GEMINI_API_KEY`, `SUNO_API_KEY`. Latest branch deployed by
building on the box.

## 2026-05-21

### Video assembly → server-side ffmpeg (`579aefc`)
fal `ffmpeg-api/compose` proved unreliable (cannot place still images on a
timeline; corrupts output duration when concatenating clips that are not
byte-identical). Rewrote `/api/video/compose` as a single server-side
ffmpeg `concat`-filter assembler that re-encodes every segment uniformly.
REQUIRES `ffmpeg` on the host.

### Deterministic card typography + "no text in video" fix
The exported video had no text because card text was being drawn by an AI
image model (unreliable). Added `src/lib/peternal-card-spec.ts` and
`/api/card/render` — renders the 13 designed caption containers as crisp
SVG → PNG. Cards composite the real pet scene + exact typography. Card
Preview got a full-view zoom modal. New `/api/video/burn-captions` (ffmpeg
lower-third overlay, P1).

### Google Drive / Dropbox links (`579aefc`)
`normalizeImageUrl` converts cloud "share" links to directly-fetchable
image URLs (Drive → `thumbnail?id=`, Dropbox → `raw=1`).

### deploy.yml — server `.env` from secrets (`fc35485`)
The deploy step writes the server `.env` from GitHub Actions secrets after
the rsync, so keys survive `rsync --delete`.

### Skill-conformance fixes (`b56b303`)
16 fixes vs the Peternal blueprint: cross-stage `resetDownstream`
invalidation, reverted to the blueprint's 12 themes (removed
`eternal_garden`), stripped internal skill-stage numbers from UI copy,
biopic beat-naming order, human-readable beat names, and more.

### Audio — coherent music bed (`b25289c`)
Single generated instrumental music bed across the whole tribute; beat
clips muted so per-clip ambient audio stops competing; accumulating A/V
drift fixed via the absolute-timeline re-encode.

### Video-generation audit (`b59771b`)
Storyline fed into the Seedance beat prompts; opening/closing cards and
per-beat captions composited into the assembled video; A/V sync corrected.

## Known issues / pending

- **fal.ai account is out of balance.** Video generation (Seedance) and the
  compose output upload still need a top-up at fal.ai/dashboard/billing.
- **Image likeness via Gemini is weaker than fal `gpt-image-2`.** When fal
  is topped up, image generation should be switched back to `gpt-image-2`
  (keeping Gemini as a fallback).
- `origin/staging` branch is behind the deployed code — staging runs the
  latest (built directly on the box); merge `Adding-skill-in-webflow` →
  `staging` to keep the CI pipeline in sync.
- P1 caption-burn and the compose route require `ffmpeg` on the deploy host.
