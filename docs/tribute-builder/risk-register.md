# Risk register

**Owner / agent type:** Architect.
**Prerequisites:** read `architecture.md` first.

## Top 5 risks (ranked by impact × likelihood)

### 1. Likeness drift at Stage 2 — CRITICAL

**Risk:** GPT Image 2 hallucinates breed traits the user knows are wrong. The spec names this the "single failure mode that ruins the tribute."

**Likelihood:** High on 1-photo inputs, medium on 3+.

**Mitigation:**
- Multi-photo upload is strongly encouraged in copy; warn-don't-block on a single photo.
- The refinement loop in Stage 2.3 appends user corrections verbatim to the prompt — backend prompt builder must concatenate, not overwrite.
- Unlimited re-rolls (no per-session cap on Stage 2 specifically). Every render is audited in `renders` for prompt iteration.
- The mandatory likeness reference sentence (`"Replicate the exact likeness, markings, proportions, and distinguishing features of [PET_NAME] from @character_sheet. Do not invent any other animal."`) is the **first line** of every downstream prompt (combination preview, storyboard, card preview, video). Verified in prompt-builder unit tests.

**Decision-log placeholder:** if drift exceeds 30% of sessions reaching ≥ 5 re-rolls in Phase 2 QA, revisit prompt engineering before Phase 3 ships.

---

### 2. Cost runaway from re-roll storms — HIGH

**Risk:** Double-tap Re-render = ~$0.80 in 10s on GPT Image 2 high quality; shared resume links amplify by N users.

**Likelihood:** Certain to happen at least once per 100 sessions without controls.

**Mitigation:**
- `Idempotency-Key` header on all render routes; unique index on `renders(session_id, stage, idempotency_key)`. Duplicate within 60s short-circuits to the existing row.
- Per-session: 1 render in-flight, 20/hr; hard $10 budget cap reads from `sum(renders.cost_usd_est)` → 429 + email to Xee.
- Per-IP middleware: 60 req/min across all `/api/*`.
- Cookie required to render (resume-token alone is read-only for safety).

**Decision-log placeholder:** if any single session exceeds $5 in Phase 1/2 QA, lower the per-session budget or add a "soft pause after 10 re-rolls — are you sure?" UX (carefully — spec forbids cost-pressure language at gates).

---

### 3. PII / data deletion for grieving users — HIGH

**Risk:** Photos of deceased pets are deeply personal; GDPR + UX sympathy both apply. A failure here is a press story, not a bug.

**Likelihood:** Low for accidental disclosure, but the floor for severity if it happens is high.

**Mitigation:**
- `DELETE /api/session/[id]` cascades to DB + R2 immediately. Surfaced as "Delete my tribute" in the UI.
- 30-day inactivity purge (daily cron + R2 lifecycle rule as backstop).
- No email captured by default in Phase 1. Resume link is the only way to return.
- Asset keys are unguessable UUIDs but assets are public; no signed URLs. **Risk: anyone with a URL can fetch.** Acceptable in Phase 1; revisit in Phase 2 if we add account-bound sessions.
- Document retention policy in `/privacy` page before Phase 1 ships.

**Decision-log placeholder:** if a user reports a stale share-link working past delete, add a global revocation table.

---

### 4. Single-point-of-failure for video (fal.ai as sole vendor) — MEDIUM-HIGH (Phase 4+)

**Risk:** Seedance 2.0 has **no direct ByteDance / Volcengine API accessible from a US-based Node server** as of 2026-05-21. fal.ai is the sole viable vendor for the video capability. If fal.ai degrades, rate-limits, or changes upstream contract terms, all video generation halts. There is no fallback path.

**Likelihood:** fal.ai uptime has been good historically, but they are a third party with their own dependencies on ByteDance's upstream cooperation.

**Mitigation:**
- The vendor abstraction is built so a future direct ByteDance/Volcengine vendor module can be added as primary without route-handler edits — if direct access becomes available later, swap in one place.
- Phase 4+ session state persists fully; on fal outage, UI shows "your tribute is saved — finishing the video is paused, we'll resume automatically" rather than failing hard. Approved character sheets, beat sheets, storyboards are durable across outages.
- Monitor fal.ai status page and recent incident history before each new phase kickoff.
- If a direct ByteDance/Volcengine API becomes available before Phase 4 ships, revisit immediately and add as primary.

**Decision-log placeholder:** record any fal.ai incidents observed during Phase 4+ QA and their resolution time. Track "minutes of video-gen unavailability" as a Phase 4+ KPI.

---

### 5. Vision-pass false confidence — MEDIUM

**Risk:** Model says "high confidence: chocolate lab" but the pet is a flat-coated retriever; user trusts and defers. Result: a tribute that subtly looks wrong.

**Likelihood:** Common on rare-breed pets and mixes.

**Mitigation:**
- Copy rule (HARD): "Looks like" / "I see" — never "is" or "must be." Enforced in `composeObservationParagraph()` and reviewed in copy QA.
- Per-field edit chips on the Stage 1.5 card; "Let me fix something" expands all chips at once.
- `inferred_confidence` logged per field. Quarterly review: if any field is corrected > 30% of the time, revise the prompt or the schema constraints.
- On the OpenAI → Gemini fallback path, prefer the higher-confidence vendor's output if both succeed during a debug session. (Phase 1 default: take primary's output always; switching logic is a Phase 2+ improvement.)

**Decision-log placeholder:** if breed correction rate > 30% in Phase 1 QA, add `low_confidence_fields[]` to the response and surface them as explicit follow-up questions instead of inline chips.

---

## Decision log

Append entries as decisions are made; do not delete history.

| Date | Decision | Owner | Rationale |
|---|---|---|---|
| 2026-05-21 | Hybrid vendor strategy (direct primary + fal fallback) adopted across all capabilities. Higgsfield removed entirely. | Architect (Jarvis) + Xee | Cost, latency, observability, and avoiding sole-vendor dependency on fal for image/vision. |
| 2026-05-21 | OpenAI GPT-4o picked over Gemini 2.5 as vision-pass primary. | Architect | One fewer API surface to operate (already keying OpenAI for images); JSON-schema enforcement is tight enough for `pet_profile_schema`. Gemini fallback is equivalent capability. |
| 2026-05-21 | fal.ai chosen as sole Seedance 2.0 vendor (Phase 4+). No direct ByteDance/Volcengine API available from US; single-vendor risk explicitly accepted. | Xee + Architect | No direct vendor exists for Seedance from a US Node server as of 2026-05-21. Re-evaluate if direct access opens up. |
| 2026-05-21 | Postgres confirmed as persistence layer. Local Postgres for dev; production host deferred until deploy target is chosen. | Xee | User preference; Drizzle works against any Postgres 14+ so the choice is reversible at deploy time. |
| 2026-05-21 | Deploy target (Vercel / EC2 fleet / other) deferred. | Xee | Decided later — Phase 1 build doesn't depend on it. |
| _open_ | Resume-link email gating (Phase 2 decision) | Xee | — |
