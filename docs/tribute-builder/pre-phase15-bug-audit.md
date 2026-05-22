# Pre-Phase-15 bug audit — 2026-05-22

Branch: `v3-zeeshan` @ `322a58e`. Audit run is static / read-only — no vendor calls, no code changes.

## Static analysis status

| Check                                          | Result |
|------------------------------------------------|--------|
| `npx tsc --noEmit`                             | clean |
| `npm run lint`                                 | clean |
| `SKIP_LIBRARY_VALIDATION=1 npm run build`      | clean (22/22 pages, no warnings) |

So the type system and ESLint are happy. The bugs below are the ones the type system can't see — wire-contract drift, race conditions, and unenforced security boundaries.

---

## Blockers — must fix before the smoke-test run

Ranked by likelihood of burning real $$ in the next 24 hours.

### B1. `/api/video/render` ignores the `Idempotency-Key` header
- **Where:** `src/app/api/video/render/route.ts` (entire route — no `Idempotency-Key` read), called from `src/components/builder/BuilderClient.tsx:1328` which DOES send one.
- **What's wrong:** The client sends `Idempotency-Key: <uuid>` (line 1332) but the route never reads it. Dedup only happens inside `enqueueVideoBatch` via `SELECT status IN ('queued','running')` — there is a race window between SELECT and INSERT. Two near-simultaneous kickoffs (slow first POST + auto-retry + an impatient user click) will both find zero in-flight rows and both INSERT N `video_clip` jobs. Each duplicate clip is **$0.50** on fal. A 12-beat tribute double-fired = **$6 wasted**.
- **What should happen:** Either consume the `Idempotency-Key` header server-side and short-circuit on a known key, or wrap the SELECT + INSERT in a transaction with a serializable isolation level / advisory lock per session.
- **Fix:** Add `Idempotency-Key` lookup against a small dedup table (or against a unique `(session_id, kind='video_clip', payload->>'beat_idx')` constraint on `render_jobs`).

### B2. Worker `notify_ready` double-enqueue race → duplicate "ready" email
- **Where:** `src/lib/queue/worker.ts:528-538` (`maybeEnqueueNotifyReady`); `src/lib/queue/finish.ts:70-104` (`getSessionJobCounts`).
- **What's wrong:** The check `counts.notifyReadyExists` is a non-atomic SELECT. Two workers (or one worker handling two near-simultaneous `clip-done` callbacks) can both see `notifyReadyExists=false` and both call `enqueueJob({kind:'notify_ready'})`. No unique constraint on `render_jobs(session_id, kind='notify_ready')` (see `src/lib/db/schema.ts:153-175`). **Result: the user gets two "your tribute is ready" emails plus two push notifications.**
- **What should happen:** Add a partial unique index on `render_jobs(session_id) WHERE kind='notify_ready'` and rely on ON CONFLICT DO NOTHING. Or wrap the check+insert in a SERIALIZABLE transaction.
- **Fix:** New Drizzle migration adding the partial unique index; use `ON CONFLICT DO NOTHING` in enqueueJob when kind==='notify_ready'.

### B3. Worker reaper (10 min) can reap a healthy in-flight Seedance call → 2× $0.50 per clip
- **Where:** `src/lib/queue/worker.ts:65` (`STALE_AFTER_MS = 10 * 60_000`); `src/lib/queue/claim.ts:76-92` (`reapStaleJobs`).
- **What's wrong:** Seedance 2.0 image-to-video typically takes 60–120s but **can exceed 10 min under fal queue pressure** (the smoke test was warned of this in the audit brief). The reaper unconditionally re-queues `locked_at < now-10min`. A different worker (or the same worker after restart) re-claims and re-fires the vendor call. **Each duplicate clip is $0.50.** No heartbeat update; `locked_at` is set once on claim and never refreshed.
- **What should happen:** Either (a) lengthen `STALE_AFTER_MS` for the video_clip kind to e.g. 20 min, or (b) add a heartbeat loop on the worker that updates `locked_at` every 60s during a long render. (a) is the 5-minute fix.
- **Fix:** Make `STALE_AFTER_MS` per-kind: `video_clip: 25*60_000`, `assembly: 15*60_000`, others stay at 10 min.

### B4. SSRF in `/api/ingest-url`
- **Where:** `src/lib/storage/ingest-url.ts:70-137` (`ingestUrlToS3`).
- **What's wrong:** Accepts any user-supplied `http:`/`https:` URL and `fetch`es it server-side. **No deny-list for private IPs / metadata services / loopback.** Content-type guard happens after fetch — by then the response has been read into memory. A user can submit `http://169.254.169.254/latest/meta-data/iam/security-credentials/` (AWS IMDSv1) or `http://localhost:5432/` (Postgres). The route is cookie-gated, but the smoke-test will be done on prod where this can leak IAM creds if the EC2 role isn't IMDSv2-only. Note that nothing in the codebase tells us IMDSv2 is enforced.
- **What should happen:** Resolve hostname → reject if any returned IP is in private range (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, `::1`, `fc00::/7`). Block non-public DNS names. Use `lookup` from `node:dns/promises` + `net.isIP` checks before fetch.
- **Fix:** New helper `assertPublicHttpUrl(url)` called at top of `ingestUrlToS3`. Block protocols other than http/https (already done). Also block when DNS resolves to a private IP.

### B5. `sessions.user_id` has no FK constraint to users
- **Where:** `src/lib/db/schema.ts:128` — `userId: uuid('user_id'),` (no `.references()`).
- **What's wrong:** When a user is deleted, sessions retain a now-orphan `user_id`. The `authBySession` user-owned recovery path at `src/lib/session/auth.ts:48-64` only checks `row.userId === userId` from the (still HMAC-valid) `auth_user` cookie. If a deleted user's auth cookie is replayed (e.g. browser kept it offline), the recovery path will succeed — granting access to a "claimed" session that no longer has a real owner. The recovery also rebinds the `peterna_session` cookie, which lengthens the exposure.
- **What should happen:** Either (a) add `references(() => users.id, { onDelete: 'set null' })` so deletion cascades, or (b) verify user existence in `authBySession` recovery before granting access.
- **Fix:** (b) is the 10-line fix; (a) requires a migration. Implement (b) now and schedule (a).

### B6. Resume token never rotates; long-lived shareable bearer
- **Where:** `src/app/api/session/resume/[token]/route.ts:38` rotates `cookieToken` but **not** `resumeToken`.
- **What's wrong:** Resume tokens are 256-bit random (good entropy), but they're permanent — once exposed (screenshot of a URL, browser history, email forward, support-ticket paste), the holder has indefinite access to the entire session including the eventual final video and eulogy PDF. The cookie_token rotation does NOT invalidate the resume token; only the cookie of the prior device is kicked.
- **What should happen:** Rotate `resumeToken` alongside `cookieToken` in the resume route, AND return the new resume token to the redeemer so they can re-bookmark. Or stamp `resume_token_used_at` and require an additional confirmation on second use.
- **Fix:** One-line in `resume/[token]/route.ts` — `set({ cookieToken, resumeToken: generateToken() })` and include the new token in the response (already in `ResumeResponse`).

---

## Bugs — should fix soon (not blocking the $10 smoke test but real correctness issues)

### G1. `wire-types.ts#SessionPatchBody` ↔ `STRING_FIELDS` drift
- **Where:** `src/lib/builder/wire-types.ts:145-187` vs `src/app/api/session/[id]/route.ts:195-234`.
- **What's wrong:** Two-way drift:
  - `SessionPatchBody` declares `beat_sheet: BeatWire[]` (line 171) — server allowlist does **not** include it. PATCHing `beat_sheet` via the generic route silently drops the field. The dedicated `/api/beat-sheet` route owns this write, but the wire-types claim it's also patchable.
  - Server `STRING_FIELDS` includes `combination_preview_asset_id` (line 212), which is **not** in `SessionPatchBody`. The comment at line 195 says "wire-types is frozen for Phase 3" but Phase 3 shipped long ago. Either expose it or drop it from the allowlist.
- **Fix:** Reconcile — drop `beat_sheet` from `SessionPatchBody` (canonical writer is `/api/beat-sheet`) and add `combination_preview_asset_id` to it.

### G2. `persistClipDone` / `setClipStatus` lost-update under concurrency
- **Where:** `src/lib/queue/worker.ts:476-526`.
- **What's wrong:** Both helpers read the full `videoClipStatuses` / `videoClipAssetIds` arrays, mutate one slot, and write the entire array back. Two concurrent `video_clip` jobs finishing at the same time can clobber each other's updates. Postgres won't catch this; the second writer's array overwrites the first writer's array — losing one slot's value. On a 12-clip render with 2 workers, this is likely.
- **Fix:** Use a single SQL UPDATE with array-element assignment (`SET video_clip_statuses[$beat_idx+1] = $status`) — Postgres supports this and it's atomic per row.

### G3. `/api/auth/magic-link/request` advertised per-IP rate limit, only per-email is implemented
- **Where:** `src/lib/builder/wire-types.ts:810` ("Rate-limited per email + per IP") vs `src/lib/auth/rate-limit.ts` (only `consumePerEmail` exported).
- **What's wrong:** A single attacker IP can iterate through addresses (3 requests per email per 15min × millions of emails per day = arbitrary email spam from the Peterna sender domain). Brevo will catch and shut down the sender domain.
- **Fix:** Add `consumePerIp` mirror with a more permissive cap (e.g. 30/15min). Use `req.headers.get('x-forwarded-for')` or `req.headers.get('x-real-ip')` carefully.

### G4. `/api/delivery/email` has no rate limit at all
- **Where:** `src/app/api/delivery/email/route.ts`.
- **What's wrong:** Cookie-gated, but an authenticated session can send unlimited emails to arbitrary recipients from a verified sender domain. Spam relay.
- **Fix:** Per-session limit (e.g. 5 sends total) + per-recipient limit (1 per minute).

### G5. Upload route TOCTOU on photo cap
- **Where:** `src/app/api/upload/route.ts:62-73`.
- **What's wrong:** SELECT COUNT then INSERT; two concurrent uploads can both pass the `>=10` check and both INSERT → 11+ photos. Minor; mostly cosmetic since the cap is a UX guard not a security bound.
- **Fix:** Wrap in `WITH inserted AS (INSERT … RETURNING …) SELECT … FROM inserted WHERE (SELECT COUNT(*) FROM assets WHERE …) <= 10` style, or add a row-level constraint via partial unique index.

### G6. `extractS3KeyFromPublicUrl` silently stores invalid r2_key on fal CDN fallback
- **Where:** `src/lib/queue/worker.ts:546-552`.
- **What's wrong:** If the vendor returns a non-S3 URL (e.g. fal returns its CDN URL and the rehost step is skipped or stripped in a future refactor), the fallback stores the entire URL as `r2_key`. Subsequent S3 deletes / lifecycle sweeps won't find the object; the asset becomes undeletable via the normal cascade. Likely benign today because the rehost always writes to S3, but a maintenance hazard.
- **Fix:** Throw on non-S3-prefix fallback and log the offending URL, so we notice if the rehost ever breaks.

### G7. Magic-link consume doesn't verify the auth_user mid-redemption can read a deleted user
- **Where:** `src/app/api/auth/magic-link/consume/route.ts:50` — `findOrCreateUser(consumed.email)` always succeeds, so this is fine in isolation. **But** combined with B5, a magic link successfully redeems and creates a new users row even if the cookie's prior referenced user was deleted. Harmless on the consume route itself; documented here as a corollary.

### G8. `bannerKeyForStage` silently falls through to `format_theme_style`
- **Where:** `src/lib/builder/state.ts:1778-1848`.
- **What's wrong:** A stage tag this function doesn't recognize (e.g. a future tag added to the union but not the helper) returns `'format_theme_style'` — the user sees the wrong banner. The function isn't a `Record<StageTag, …>` (would be exhaustive), it's a chain of `if`s.
- **Fix:** Replace with a `Record<StageTag, BannerKey>` lookup so TS catches missing tags at compile time.

---

## Smells — low priority

### S1. `SMTP_PORT` env parsing
- **Where:** `src/lib/delivery/mailer.ts:53`.
- **What's wrong:** `Number(process.env.SMTP_PORT?.trim() || 587)` — when `SMTP_PORT` is `"foo"`, `Number("foo") = NaN`, and nodemailer will fail with a confusing error. Validate it.

### S2. `BuilderProgressRail` comments say "8 segments" but there are 9
- **Where:** `src/components/builder/BuilderProgressRail.tsx:7,21`.
- Comment vs code drift. The aria-label and counter use `SEGMENT_LABELS.length` correctly (9). Just stale comments.

### S3. Hex colors not coming from `peterna-tokens.ts`
- **Where:** ~25 occurrences of `#FFFBF3`, `#2A211B`, `#F8F1E4`, `#8A3737`, `#a05a3c` across builder components.
- Pre-existing drift point; the new UI components (`buttons.tsx`, `WelcomePanel.tsx`, `BuilderProgressRail.tsx`, `HelpFooter.tsx`) all use `C.*` cleanly. Worth tightening pre-Phase-15.

### S4. `prefersReducedMotion()` SSR/client mismatch in variant initial states
- **Where:** `src/lib/builder/motion-tokens.ts:53-56`.
- During SSR returns `false` → variants render `hidden: { y: 8 }`. On hydration with `prefers-reduced-motion`, returns `true` → `hidden: { y: 0 }`. **Hydration mismatch on the affected user's first paint.** Likely benign because framer-motion controls inline styles post-mount, but worth a fix to compute the variant once on the client.

### S5. Upload routes don't write `metadata` (audit task mentioned)
- **Where:** `src/app/api/upload/route.ts:84-95`, `src/app/api/ingest-url/route.ts:80-92`.
- The schema column exists; nothing is written. Not a correctness issue today but blocks any future per-asset audit/feature.

### S6. `secondBestMove` swap map doesn't have a `?? fallback` for unknown camera_moves
- **Where:** `src/lib/cinematography/consistency-pass.ts:179-202`.
- All current values are mapped, but if the `MotionBriefWire.camera_move` union grows, the lookup returns `undefined` and the result spreads `undefined` into `camera_move`. Add `?? 'locked_off'` for forward-safety.

### S7. `HelpFooter` outside-click handler uses `mousedown` — touch users may miss it
- **Where:** `src/components/builder/HelpFooter.tsx:34`.
- iOS Safari often suppresses mousedown for tap events on non-button elements. Use `pointerdown` for parity. Low-impact.

### S8. `WelcomePanel` `AffirmBtn` confirm haptic on first interaction
- The first thing the user does is "Start when you're ready" which fires a haptic-confirm — fine, but a tap-style haptic might be more appropriate for "I'm beginning" vs "I'm affirming." Subjective; not blocking.

---

## Wire-contract drift findings

1. `SessionPatchBody.beat_sheet` not in PATCH allowlist → silently dropped. (G1)
2. PATCH allowlist `combination_preview_asset_id` not in `SessionPatchBody` → typed client can't see it. (G1)
3. `bannerKeyForStage` is not exhaustively typed; new StageTag additions silently land in `format_theme_style`. (G8)
4. `EulogyApproveResponse` envelope is correctly typed; server skips `eulogy_complete` and jumps to `delivery_ready` — client compensates locally via a separate `delivery_finalize_started` event. **Not a bug**, but worth noting: a session reload mid-eulogy-complete will *not* show the soft-pause panel.

---

## Auth-correctness findings

1. **B5**: `sessions.user_id` has no FK; `authBySession` recovery path doesn't verify user still exists.
2. **B6**: Resume token never rotates.
3. **G3**: Magic-link request route has only per-email rate limit, not per-IP as documented.
4. **G7**: Magic-link consume route is fine; the issue is purely a corollary of B5.
5. Cookie expiry: `auth_user` cookie has 30-day rolling maxAge + HMAC-encoded expiry inside the payload (correct double-defense). `peterna_session` cookie has only the maxAge (no payload expiry) — a 30-day-old cookie still passes HMAC verify until the cookie file ages out. Acceptable, since the DB row's `cookieToken` is the secondary check, but inconsistent.

---

## Storage + asset findings

1. **B4**: SSRF in `/api/ingest-url`.
2. **G5**: TOCTOU on photo cap in `/api/upload`.
3. **G6**: `extractS3KeyFromPublicUrl` non-S3-prefix fallback is dangerous if vendor URLs ever leak through.
4. **S5**: Upload routes don't write `metadata`.
5. Drive regex `/(?:^|\.)drive\.google\.com$/i` correctly matches `drive.google.com` and `*.drive.google.com`; `view?usp=sharing` URLs work because the regex only consumes `/file/d/<id>` — the query string is irrelevant.
6. Dropbox `?dl=0 → ?dl=1` works correctly via `searchParams.set('dl', '1')`.

---

## Vendor-layer findings

1. **Content-policy correctly skips fal fallback** (`src/lib/ai/generate-image.ts:79`). ✓
2. **Invalid input correctly skips fallback** (line 94). ✓
3. fal endpoints are pinned: `fal-ai/openai-gpt-image-2/edit-image`, `fal-ai/openai-gpt-image-2/text-to-image`, `bytedance/seedance-2.0/image-to-video`. Verify against the fal dashboard before the smoke test — fal periodically renames endpoints with no deprecation notice.
4. `costUsdEst` is logged as null on failure rows. The admin dashboard's `SUM(cost_usd_est)` correctly omits these. ✓
5. `logRender` writes vendor_attempted = `['openai']` on content_policy (attempts array is pushed before throw). ✓

---

## Cinematography-engine findings

1. `applyConsistencyPass` **does not mutate** the input — returns new objects via spread. ✓
2. Calm bookends correctly applied to beat 0 and beat N-1; `single_sustained` enforced. ✓
3. DP overlay `none` no-op path is in `derive-motion-brief.ts` (verified earlier via tsc) — same code path with biases all `null`. ✓
4. **S6**: `secondBestMove` swap doesn't fallback when the union grows. Worth a one-line fix.

---

## Worker + queue findings

1. **B1**: `/api/video/render` ignores Idempotency-Key.
2. **B2**: `maybeEnqueueNotifyReady` race → double-email.
3. **B3**: 10-min reaper threshold too short for long Seedance renders.
4. **G2**: Read-modify-write on `videoClipStatuses` / `videoClipAssetIds` arrays loses concurrent updates.
5. **G6**: `extractS3KeyFromPublicUrl` fallback hazard.
6. Worker `tsx --env-file=.env.local` loading — verified config (b2ae91b commit) wires this in `package.json` worker script. ✓ assuming the script invocation is actually `tsx --env-file=.env.local scripts/worker.ts`.

---

## UI specifically

1. **BuilderProgressRail**: 9 segments (labels Intake…Eulogy). The `STAGE_TO_RAIL_SEGMENT` map is exhaustive (typed `Record<StageTag, number>` — TS enforces). The fallback `?? 0` is dead code in practice but defensive. ✓
2. **WizardShell** wraps content in `.peterna-wizard-root`, and the inlined `:focus-visible` CSS scopes correctly. ✓
3. **HelpFooter**: ESC + outside-click both close the panel. Toggle button works because the click handler runs after the outside-click handler (mousedown → click order). One smell: `mousedown` may miss touch users (**S7**).
4. **WelcomePanel** correctly calls `onBegin` via the AffirmBtn prop chain → BuilderClient `dispatch({ type: 'start_intake' })`.
5. **`prefersReducedMotion()` SSR hazard** (**S4**) — minor.
6. **buttons.tsx**: Submit-type buttons render correctly; haptic fires before user-supplied `onClick`. `<motion.button disabled>` is correctly applied for inactive state.

---

## Recommended fix order (smallest-actionable first)

1. **B6** — resume token rotation: 5-line edit in `src/app/api/session/resume/[token]/route.ts`.
2. **B3** — bump `STALE_AFTER_MS` per kind: 10-line edit in `src/lib/queue/worker.ts` + `src/lib/queue/claim.ts`.
3. **B5** — `authBySession` user-existence check: 8-line edit in `src/lib/session/auth.ts`.
4. **G1** — wire-contract reconcile: drop/add fields between `wire-types.ts` and the PATCH allowlist. 15-line diff.
5. **B2** — partial unique index on `render_jobs(session_id) WHERE kind='notify_ready'`: new Drizzle migration + `ON CONFLICT DO NOTHING` in `enqueueJob`.
6. **B1** — Idempotency-Key consumption in `/api/video/render`: requires either an idempotency lookup table or wrapping the SELECT+INSERT in a serializable txn.
7. **B4** — SSRF guard in `ingestUrlToS3`: ~30-line helper + integration. Most invasive of the blockers but highest security upside.
8. **G2** — array-element atomic update in worker `persistClipDone` / `setClipStatus`.
9. **G3 + G4** — per-IP rate limiter shared between `magic-link/request` and `delivery/email`.
10. **G5, G6, S1–S8** — clean-up pass after the smoke test ships.
