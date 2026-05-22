# Changelog

Notable changes to the Peternal tribute builder (`/builder`). Newest first.
Working branch: `Adding-skill-in-webflow`.

## 2026-05-22

### Download progress bar + generated-asset logging
- **Progress bar:** the "Download tribute" flow now shows a real progress bar
  with phase-aware text ("Preparing the narration…" → "Assembling your
  tribute…" → "Downloading…") instead of a static line. The bar eases from 5%
  and caps at 92% during the opaque compose, then completes on download.
- **Asset logging (recovery):** every paid generation now logs its URL to the
  server log with a greppable tag — `[GEN-BEAT]`, `[GEN-NARRATION]`,
  `[GEN-MUSIC]` — and compose logs one `[COMPOSE-INPUTS]` JSON line with every
  input URL (beat videos, cards, audio) plus `[COMPOSE-OUTPUT]` /
  `[COMPOSE-FAILED]`. So if a compose fails, the expensive Seedance/audio URLs
  are recoverable from the log and ffmpeg can be re-run by hand.

### 1-minute tribute length option
Added a **1-minute** option (8 beats, ~7s each) alongside 2/3/4 minutes — a
shorter tribute means fewer Seedance video-seconds, so a test run costs
roughly $16–22 instead of $25–30. The length picker now keys its "active"
state and change-detection on `targetMinutes` (1- and 2-minute both use 8
beats, so `beatCount` alone can't tell them apart).

### Narration voice — calmer and quieter (less "performed")
The ElevenLabs voice was too loud and too theatrical for a memorial. Lowered
the narration volume (1.0 → 0.7), eased the low-mid EQ, raised `stability`
(0.55 → 0.82), removed `style` exaggeration (0.12 → 0), and slowed `speed`
(0.88 → 0.82) for an unhurried, gentle read. (Note: full emotional realism —
sighs, breathiness — needs ElevenLabs v3; this is the `multilingual-v2`
ceiling.)

### Critical — narration ffmpeg filter mangled by the build minifier
Every compose with narration failed: `ffmpeg exited 234 ... Invalid argument`.
`NARR_POST` (the narration audio filter chain) was built as a
`` `…,` + `…,` + `…` `` template-literal concatenation. The production build
minifier (SWC) **dropped the boundary commas** during constant folding —
`…g=-2.5,aecho=…` compiled to `…g=-2.5aecho=…` — producing an unparseable
ffmpeg filtergraph. The source was correct; the *compiler* broke it.
Rewrote `NARR_POST` as a single flat string literal (a minifier cannot alter
literal content) and verified the compiled `.next` output.

### Dry-run fixes — beat motion + narration grammar
A no-API-call dry-run (347 assertions) caught four bugs:
- **Ship-blocker:** the cinematography engine read `beat.sceneHintSource` (a
  favorite id) instead of `beat.visual` for motion-energy detection, so memory
  beats fell back to `loop_idle` (still pet) — half-defeating the beat-motion
  fix. Now reads `beat.visual`; energetic memories get real `loop_action` /
  `one_shot_action` motion.
- Narration fallback: fixed "they was" → "they were" (neutral-gender copula),
  raw relationship ids leaking into prose (new `narrationPhrase` field per
  relationship), and a lowercase sentence start on an empty pet name.

### Burned narration subtitles (opt-out)
The spoken narration can now appear as on-screen subtitles, synced to the
voice. ElevenLabs returns word-level timestamps on the same TTS call (a free
flag — no extra cost), so each line appears exactly as it's spoken; a
fallback distributes lines evenly if timestamps are missing. Rendered as a
styled ASS lower-third (soft dark panel, Inter, warm off-white, fades) burned
in during compose, positioned to never collide with the beat captions. A
toggle in "The Words" (on by default) lets the user opt out. Inter font
installed on the server so subtitles render on-brand.

### Beat videos — fixed the "dog just breathing" stillness
The Seedance beat prompts handed the model raw internal enum tokens
(`camera move: slow_push`, `subject motion: breath_only`) — jargon a video
model can't act on — so clips barely animated. Plus the cinematography engine
collapsed most beats to `breath_only`. Fixed:
- New `peternal-motion-phrasing.ts` translates every cinematography enum into
  vivid, directive motion language.
- `buildBeatPrompt` rewritten — leads with a "this is a moving clip, not a
  still" mandate, an archetype motion directive, and full motion sentences for
  camera, subject, lighting; the raw jargon line is gone.
- Engine: memory beats no longer default to a lying/`breath_only` pose;
  action keywords broadened; medium/high-energy memory/connection/release
  beats now get real `loop_action`/`one_shot_action` motion. Calm
  opening/closing bookends preserved.
Render tier unchanged (fast) — zero added cost.

### Video length, narration script, and a warmer voice
Audit of a real downloaded tribute found a 2-minute tribute produced a **6:43**
file — ~5 minutes of frozen frame. Three fixes (architect-planned, reviewed):
- **Duration:** compose hard-coded a 300s last-frame freeze. Output length is
  now exactly `max(video, narration)` — no dead frozen tail. Narration drives
  length only when it is genuinely longer than the video.
- **Narration script:** was a ~50-word template (~18s of speech). Now composed
  by Gemini — a ~220-word first-person tribute that follows the beat arc and
  uses the owner's real inputs, so it spans the video. Template kept as a
  fallback. Narration route returns a probed `durationMs` so compose sizes the
  timeline exactly.
- **Voice:** switched from Minimax to ElevenLabs (`multilingual-v2`) at a slow,
  gentle memorial pace, plus light warmth EQ + a faint room on the narration —
  markedly less synthetic.

### Narration now plays in the in-app preview
The `TributePlayer` preview only ever played the music bed — narration was
generated solely at download time, so playing the preview with narration on
was silent (and misleading: it looked like narration was broken). Now the
narration voiceover is generated when the tribute screen loads, stored in
`state.narrationUrl`, played by the preview, and reused at compose time
(no longer regenerated on download).

### Video pipeline — fixed "no text" and "no narration"
End-to-end audit of the tribute video generation. Confirmed user-reported
failures fixed:
- **No text:** `/api/card/render` returned card images as `data:` URLs, which
  `/api/video/compose` rejected (https-only validation) — cards were never
  assembled. Card PNGs are now uploaded to fal storage and returned as https
  URLs.
- **No narration:** the script was built from the 6 raw (usually blank)
  narration answers, so narration was skipped entirely; the selected voice was
  never sent. Added `composeNarration()` (always produces real prose), mapped
  the library voices to valid Minimax presets, and the chosen voice is now sent.
- **Download:** cross-origin `a.click()` could open the file in a tab — now
  fetches a blob and downloads reliably; stale composed-URL cache removed.
- **Skill balance:** compose now trims each beat to `perBeatMs` so total length
  honors the chosen 2/3/4-minute target; preview pacing matches export.
- **Narration not cut off:** compose holds the last frame (`tpad`) so a long
  voiceover is never truncated; errors surface in a visible panel.

### Image generation reverted to fal `gpt-image-2`
The fal.ai account was topped up (credit check confirmed it's no longer
locked). Reverted `/api/image/edit` from Gemini 2.5 Flash Image back to fal
`openai/gpt-image-2/edit` — the skill-mandated model, and the one with the
stronger pet-likeness fidelity. `/api/card/render` keeps returning a data URL
(no need to put it back on fal.storage). Video generation also unblocked by
the top-up.

### Card layout — text no longer covers the pet's face
Per the skill, every caption container is *"centered in the lower portion of
the frame."* The renderer was placing opening/closing title panels at 38% frame
height — directly over the pet's face — a skill violation. Now ALL card text
(opening, closing, caption) sits in the lower portion, leaving the face clear.
Also removed the internal dev label ("OPENING TITLE" / "CLOSING CARD") that was
being burned into the card image, and the full-frame dark scrim that dimmed the
whole pet (the container panel carries its own legibility).

### Suno polling — handle CALLBACK_EXCEPTION
Audited the Suno integration. `src/lib/suno.ts` only treated `SUCCESS` as done.
Because the integration sends a placeholder `callBackUrl` and polls instead,
the task can settle as `CALLBACK_EXCEPTION` (generation succeeded, webhook
delivery failed) — the old code would then poll to the 4.5-min timeout and
fail. Fixed: `CALLBACK_EXCEPTION` is now treated as success (audio extracted
from `sunoData`). Also added a NaN-duration guard and a consecutive-poll-error
cap so a hard failure bails fast instead of hanging the full window.

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

- **Share link deferred.** "Get my memorial page link" (and "Add to family
  channel") remain no-op stubs. PostgreSQL is provisioned on the staging box
  (database `peterna`, `tributes` table) and `DATABASE_URL` is set in both
  environments — dormant and harmless until the feature is built later.
- **Music library has no audio files.** A Suno-generated per-tribute bed is
  the current stopgap; the skill-faithful fix (curated track files) is
  deferred — audio to be sourced separately.
- `origin/staging` branch is behind the deployed code — staging runs the
  latest (built directly on the box); merge `Adding-skill-in-webflow` →
  `staging` to keep the CI pipeline in sync.
