# Peterna — Product Architecture Blueprint

Status: DESIGN (no code). Owner: architect. Consumers: coder, devops, QA.
Scope: turn the anonymous single-flow builder into a multi-tenant product with
email+password auth, per-user dashboards, a complete admin dashboard, and a
decoupled API/frontend deployment. Billing is DEFERRED but the data model and
API are billing-READY.

Grounded in the live code as of branch `feat/storyboard-photo-reference`:
- Next.js 16.2.6 / React 19 / Prisma 6 + Postgres / webpack. Middleware is now
  `proxy.ts` (Next 16 rename — node_modules/next/dist/docs/.../16-proxy.md).
- `Build` (Prisma) stores the ENTIRE `BuilderState` as one `Json` blob keyed by
  cuid; no userId. A separate LEGACY raw-`pg` `tributes` table (src/lib/db.ts)
  backs the public share page `/tribute/[id]` and is NOT in the Prisma schema.
- Generation routes (api/video/*, image/*, etc.) are THIN orchestrators. Heavy
  compute runs on fal.ai (Seedance beats, Suno/fal music, fal narration, fal
  ffmpeg assemble). The one genuinely local heavy job is `/api/video/compose`
  (local ffmpeg, maxDuration 300, already serialized one-at-a-time). Long jobs
  already use a client-driven async pattern: fal.queue.submit -> requestId ->
  client polls /api/video/status. The codebase is ALREADY decoupling-friendly.
- Assets re-hosted to S3 (src/lib/server/storage.ts) when AWS_* set; else stay
  on fal (~24h TTL). `/api/download` is a same-origin proxy to dodge CORS.

---

## 0. DESIGN SUMMARY (the decisions, up front)

1. Two deployments, ONE codebase (monorepo), ONE Prisma schema.
   - api.peterna.com — Next.js run API-ONLY (route handlers, no UI shipped).
     Owns the DB, auth, all generation orchestration, S3, fal/Suno/Gemini keys.
   - app.peterna.com — Next.js frontend (marketing + builder + dashboards).
     Talks to the API over HTTPS. Holds NO secrets, NO DB access.
   - Why Next for the API (not Express/Fastify/Nest): the team already runs
     Next+Prisma on EC2/pm2; every existing handler (build, tribute, video/*,
     image/*) ports with near-zero rewrite — they are already Request ->
     NextResponse handlers. Nest/Fastify forces rewriting ~19 working endpoints
     + the fal/ffmpeg/storage libs for zero functional gain. Decoupling here is
     a DEPLOYMENT split, not a framework change. Boring wins.

2. Auth transport: cross-subdomain cookie, NOT bearer-in-localStorage.
   Both apps are under *.peterna.com. Session cookie with
   Domain=.peterna.com; HttpOnly; Secure; SameSite=Lax. Browser sends it on
   every api.peterna.com request. HttpOnly kills XSS token theft. Requires CORS
   with Allow-Credentials:true + explicit origin allowlist (no wildcard).

3. Session strategy: opaque server-side sessions (DB-backed), not JWT.
   Random 256-bit token, SHA-256 hashed at rest in a Session row. Lets admin
   "deactivate user" / "force logout" revoke INSTANTLY — a stateless JWT cannot
   be revoked before expiry, which directly conflicts with the required
   activate/deactivate feature. Sliding 30-day expiry, rotate on privilege chg.

4. One ownership model. Unify `Build` and `tributes` into `Video`.
   Build becomes the draft/working row; a finished tribute is publishedAt +
   shareSlug on the SAME row. KEEP the JSON-blob `state` (works; no cross-field
   queries) but ADD normalized indexed columns (userId, status, lifecycle,
   thumbnailUrl, finalVideoUrl) so dashboard/admin query without parsing the
   blob. Legacy `tributes` migrates into Video (read shim during transition).

5. Generation jobs stay server-driven async, now persisted as `Job` rows.
   Today the CLIENT holds requestIds in React state and polls — breaks if the
   tab closes mid-render (minutes long). Promote jobs to Job rows so progress
   survives reloads and admin sees queue health. Client still polls
   (GET /jobs/:id) but state is durable. fal webhooks optionally fast-path
   completion (api.peterna.com is now publicly reachable, so the webhookUrl
   param the beat route already supports finally has a home).

6. Billing-ready seam: inert Plan / Order / Entitlement tables now.
   Defined, migrated, never written by app logic yet. A single
   assertCanCreateVideo(user) / assertCanPublish(video) policy fn is the ONE
   seam where Stripe later plugs in. Today both return "allowed".

---

## 1. TARGET ARCHITECTURE & TOPOLOGY

### 1.1 Repository layout (monorepo, shared schema)

```
peterna/
  packages/
    db/        # Prisma schema + client + migrations (single source of truth)
    shared/    # shared TS types: API DTOs, BuilderState type, zod schemas
  apps/
    api/       # Next.js, API-only. Deploys to api.peterna.com
      app/
        auth/...     # /auth/* route handlers
        me/...       # /me, /videos/*
        admin/...    # /admin/* route handlers
        (generation) # ported video/*, image/*, card/*, photo/*, audio/*
      lib/server/    # storage.ts, fal.ts, prisma, auth, jobs
      proxy.ts       # CORS + optimistic session (Next 16 proxy convention)
    web/       # Next.js frontend. Deploys to app.peterna.com
      app/
        (marketing)/ # existing pages: /, /pricing, /faq, etc.
        builder/     # existing wizard, now calls api.peterna.com
        dashboard/   # NEW user dashboard
        admin/       # NEW admin dashboard UI
        tribute/[slug]/  # public share page (SSR-fetches from api)
      lib/api-client.ts  # typed fetch: base URL + credentials:'include'
```

Interim allowed if a formal monorepo is too disruptive for phase 1: two sibling
app dirs importing a shared prisma/ + types/ via path alias — but commit to the
monorepo by phase 2 to avoid schema drift. (Open decision 8.1.) Keeps webpack;
no turbopack needed.

### 1.2 What lives where

API service (api.peterna.com) — the trust boundary, holds ALL secrets:
- Auth, session issuance + validation.
- DB (Prisma) — SOLE writer. web NEVER touches Postgres.
- All generation orchestration: ported video/*, image/*, card/render, photo/*,
  audio/upload, gemini. Now ownership-checked.
- Job lifecycle + fal webhooks + S3 rehost. Local ffmpeg for compose.
- /api/download proxy stays here (S3 + fal allowlist already pinned).
- Admin endpoints + audit logging.

Frontend (app.peterna.com) — no secrets:
- Marketing/SSG pages (unchanged). Builder wizard (fetches go to API base URL
  with credentials). Dashboard + Admin UI. Public tribute page SSR-fetches
  GET /public/videos/:slug from the API.

### 1.3 Stack decision for the API service — JUSTIFIED

Recommendation: Next.js 16, run API-only (no UI routes, standalone output,
behind pm2 like today). Reasons ranked:
- Zero-rewrite port of 19 existing handlers + fal/storage/subtitle/prompt libs.
- Same deploy muscle (pm2 on EC2; the prisma db push + generate pre-build step
  already in the team runbook).
- Route handlers give runtime='nodejs', maxDuration, streaming responses
  (needed by /download and compose) for free.
- Decoupling is satisfied by SEPARATE DEPLOYMENT + CORS, orthogonal to runtime.

Rejected: Fastify/Express (forces rewriting all handlers + multipart + streaming
download; gains nothing today). NestJS (heavy DI ceremony for a ~30-endpoint
API; over-engineering at current scale). Standalone job-worker (deferred, §8).

### 1.4 Long-running generation across the decoupled boundary

The boundary changes nothing about how fal works; it changes WHERE state lives.

Current (client-held state):
  client -> POST /api/video/beat -> fal.queue.submit -> {requestId}
  client polls GET /api/video/status?requestId -> COMPLETED + url
  (tab close => requestId lost; partial work stranded on fal)

Target (durable Job rows):
  client -> POST /videos/:id/jobs {kind:'beat', beatIndex, ...}
    -> API creates Job(queued), fal.queue.submit, stores requestId+endpoint,
       returns {jobId}
  client polls GET /jobs/:jobId
    -> API checks fal status; on COMPLETED rehosts to S3, writes url into
       Video.state, marks Job done, returns url
  Optional fast-path: webhookUrl = https://api.peterna.com/webhooks/fal
    -> API marks the Job done immediately

Where compute runs: still fal for beats/music/narration/assemble. Local ffmpeg
compose runs on the API box (already does; maxDuration 300; already serialized
one-at-a-time per commit 949e892). At current scale (~50 users-order, demos)
inline compose is fine. A dedicated worker queue (BullMQ/SQS) is DEFERRED until
compose concurrency bottlenecks; the Job table already models what a worker
would need, so the upgrade is non-breaking.

### 1.5 Request-flow diagrams

LOGIN
  [web] POST /auth/login {email,password}
    API: find user, argon2.verify, check status=ACTIVE
         create Session row, Set-Cookie pna_session; Domain=.peterna.com
    200 {user:{id,email,role}}
  subsequent requests carry the cookie automatically (credentials:'include')

CREATE VIDEO
  [web] "New tribute" -> POST /videos {}
    API: requireUser; assertCanCreateVideo (billing seam, today=allow)
         create Video(userId, status='DRAFT', state=initialState); AuditLog
    201 {id}
  [web] push app.peterna.com/builder?id=<id>

RUN A GENERATION JOB (beat)
  [builder] POST /videos/:id/jobs {kind:'beat', beatIndex, payload}
    API: requireUser; assertOwner; fal.queue.submit; Job(queued, requestId)
    202 {jobId}
  [builder] poll GET /jobs/:jobId -> running ... -> done {url}
    API on done: rehost->S3, patch Video.state.beatVideos[i], AuditLog
  (fal webhook -> /webhooks/fal may complete before the next poll)

VIEW DASHBOARD
  [web] GET /videos?status=&page
    API: requireUser -> SELECT Video WHERE userId=me (indexed cols, not blob)
    200 {videos:[...], page}

ADMIN VIEW
  [web] GET /admin/users?q=&status=&sort -> requireAdmin -> users + counts
  [web] GET /admin/users/:id -> user + videos + recent AuditLog + sessions
  [web] GET /admin/videos/:id -> FULL detail incl parsed state, jobs, assets

---

## 2. DATA MODEL (Prisma)

Single schema in packages/db. Build is absorbed into Video. Sketch — coder finalizes syntax.

```prisma
// ---------- Identity ----------
model User {
  id            String     @id @default(cuid())
  email         String     @unique          // store lowercased
  passwordHash  String                       // argon2id
  role          Role       @default(USER)
  status        UserStatus @default(ACTIVE)  // ACTIVE | DEACTIVATED
  emailVerified DateTime?                     // null = unverified
  name          String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  lastLoginAt   DateTime?
  sessions      Session[]
  videos        Video[]
  auditLogs     AuditLog[]    @relation("ActorLogs")
  tokens        AuthToken[]
  orders        Order[]
  entitlements  Entitlement[]
  @@index([status])
  @@index([createdAt])
}
enum Role       { USER ADMIN }
enum UserStatus { ACTIVE DEACTIVATED }

model Session {
  id         String   @id @default(cuid())
  userId     String
  tokenHash  String   @unique          // SHA-256 of the random cookie value
  user       User     @relation(fields:[userId], references:[id], onDelete:Cascade)
  createdAt  DateTime @default(now())
  expiresAt  DateTime                   // sliding 30d
  lastSeenAt DateTime @default(now())
  ip         String?
  userAgent  String?
  revokedAt  DateTime?                  // logout / deactivate / force-logout
  @@index([userId])
  @@index([expiresAt])
}

model AuthToken {
  id         String        @id @default(cuid())
  userId     String
  user       User          @relation(fields:[userId], references:[id], onDelete:Cascade)
  kind       AuthTokenKind                  // EMAIL_VERIFY | PASSWORD_RESET
  tokenHash  String        @unique          // SHA-256 of emailed token
  expiresAt  DateTime
  consumedAt DateTime?
  createdAt  DateTime      @default(now())
  @@index([userId, kind])
}
enum AuthTokenKind { EMAIL_VERIFY PASSWORD_RESET }
```

```prisma
model Video {
  id            String      @id @default(cuid())
  userId        String?                       // nullable: anonymous legacy rows
  user          User?       @relation(fields:[userId], references:[id])
  petName       String?                       // denormalized INDEXED cols below
  status        VideoStatus @default(DRAFT)
  stepIndex     Int         @default(0)
  thumbnailUrl  String?
  finalVideoUrl String?
  durationSec   Int?
  state         Json                          // entire BuilderState blob (unchanged approach)
  shareSlug     String?     @unique           // public URL token (was tributes.id)
  publishedAt   DateTime?
  openingText   String?
  closingText   String?
  years         String?
  creatorName   String?
  tier          String?                       // billing seam (inert today)
  orderId       String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  deletedAt     DateTime?                      // soft delete
  jobs          Job[]
  auditLogs     AuditLog[]
  @@index([userId, status])
  @@index([updatedAt])
  @@index([status])
  @@index([shareSlug])
}
enum VideoStatus { DRAFT GENERATING READY PUBLISHED ARCHIVED FAILED }

model Job {
  id           String    @id @default(cuid())
  videoId      String
  video        Video     @relation(fields:[videoId], references:[id], onDelete:Cascade)
  kind         JobKind
  status       JobStatus @default(QUEUED)
  beatIndex    Int?
  falEndpoint  String?
  falRequestId String?
  input        Json?
  result       Json?                           // url, etc
  error        String?
  attempts     Int       @default(0)
  createdAt    DateTime  @default(now())
  startedAt    DateTime?
  finishedAt   DateTime?
  @@index([videoId])
  @@index([status])
  @@index([falRequestId])
}
enum JobKind   { BEAT MUSIC NARRATION ASSEMBLE COMPOSE IMAGE CARD GEMINI }
enum JobStatus { QUEUED RUNNING DONE FAILED }

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?                           // null = system
  actor      User?    @relation("ActorLogs", fields:[actorId], references:[id])
  videoId    String?
  video      Video?   @relation(fields:[videoId], references:[id])
  action     String                            // auth.login, video.created, job.failed, admin.user.deactivated
  targetType String?
  targetId   String?
  metadata   Json?
  ip         String?
  createdAt  DateTime @default(now())
  @@index([actorId, createdAt])
  @@index([videoId])
  @@index([action, createdAt])
  @@index([createdAt])
}
```

```prisma
// ---------- Billing-ready (inert until Stripe phase) ----------
model Plan {
  id         String   @id @default(cuid())
  code       String   @unique     // instant, essential, premium, elite, family_channel
  name       String
  kind       PlanKind             // ONE_TIME | SUBSCRIPTION
  priceCents Int
  interval   String?              // month, year, lifetime, or null
  active     Boolean  @default(true)
  metadata   Json?
}
enum PlanKind { ONE_TIME SUBSCRIPTION }

model Order {
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields:[userId], references:[id])
  planCode    String
  amountCents Int
  status      OrderStatus @default(PENDING)    // PENDING PAID REFUNDED FAILED
  provider    String?                          // stripe later
  providerRef String?
  videoId     String?                          // one-time tiers attach to a video
  createdAt   DateTime    @default(now())
  paidAt      DateTime?
  @@index([userId])
  @@index([status])
}
enum OrderStatus { PENDING PAID REFUNDED FAILED }

model Entitlement {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields:[userId], references:[id])
  planCode  String
  source    String                             // order:ID or admin_grant
  startsAt  DateTime  @default(now())
  endsAt    DateTime?                           // null = perpetual
  revokedAt DateTime?
  @@index([userId])
}
```

### 2.1 Migration of EXISTING data

a) Prisma Build rows (anonymous drafts, JSON blob, no user):
   - Additive migration extends Build INTO Video: add new columns (userId
     nullable, status, shareSlug, ...); backfill status=DRAFT, userId=NULL, keep
     petName/stepIndex/state as-is. The state blob format is UNCHANGED so the
     wizard keeps reading it.
   - These become CLAIMABLE orphans: keep userId=NULL. When a logged-in user
     resumes via ?id=, offer "save to my account" -> sets userId. Un-resumed
     anonymous drafts swept after 30 days (no owner, no value).

b) Legacy raw-pg tributes table (public share, not in Prisma):
   - One-time backfill: each tributes row -> a Video with status=PUBLISHED,
     shareSlug = old tributes.id (preserves existing /tribute/UUID URLs), copy
     pet_name/video_url/opening_text/closing_text/years/creator_name.
   - Keep tributes READABLE during transition (public page falls back to it if a
     slug is not found in Video). Drop it in a later cleanup migration.
   - RECOMMENDATION: fold tributes into Prisma now — one DB access path. The
     dual-store split was a historical accident, not a design.

### 2.2 Indexing rationale
- Video(userId,status) — dashboard primary query.
- Video(updatedAt) — admin "recently active" + existing picker order.
- Video(shareSlug) — public page lookup, O(1).
- Session(tokenHash unique) — per-request login validation = one indexed lookup;
  Session(expiresAt) — cron sweep.
- AuditLog(action,createdAt) + (actorId,createdAt) — admin filter/timeline.

---

## 3. AUTH DESIGN (email + password)

### 3.1 Password hashing
argon2id (argon2 npm, native). Memory-hard, current OWASP recommendation. Reject
bcrypt (72-byte truncation, weaker). Params m=19456KiB, t=2, p=1 (OWASP
baseline) — tune on the API box.

### 3.2 Flows
- Register POST /auth/register {email,password,name}: validate (zod), lowercase
  email, check uniqueness, argon2id hash, create User(status=ACTIVE,
  emailVerified=null), create EMAIL_VERIFY AuthToken, email a verify link
  app.peterna.com/verify?token=. RECOMMENDATION: allow login but gate PUBLISHING
  (not building) on verified email — try the builder immediately, block spammy
  public pages. (Open decision 8.2.)
- Verify POST /auth/verify {token}: hash, find unconsumed unexpired token, set
  emailVerified=now, consume token.
- Login POST /auth/login {email,password}: find user, argon2.verify, reject if
  status=DEACTIVATED, create Session, Set-Cookie. Always run a dummy hash on an
  unknown email to equalize timing (no user-enumeration via response time).
  Generic error "invalid email or password".
- Logout POST /auth/logout: set Session.revokedAt, clear cookie.
- Password reset: POST /auth/forgot {email} always returns 200 (no enumeration);
  if the user exists create PASSWORD_RESET token (15-min TTL), email link. POST
  /auth/reset {token,newPassword}: verify token, set new hash, revoke ALL the
  user sessions (force re-login everywhere).
- Me GET /me returns the current user from the session, or 401.

### 3.3 Session lifetime + rotation
30-day sliding expiry; refresh expiresAt + lastSeenAt on use (throttle the DB
write to once/hour to avoid write amplification). Rotate the token on password
reset and on role change (revoke old, issue new). Cron sweeps expired plus
revoked-older-than-7d rows.

### 3.4 Brute force / rate limiting
Per-IP plus per-email throttle on /auth/login and /auth/forgot (e.g. 5 tries per
15 min, exponential backoff). Implement in proxy.ts or a small in-DB counter, or
Redis if available. At current scale a Postgres-backed counter is sufficient;
flag Redis for later (section 8). Generic errors plus constant-time compare
everywhere in auth.

### 3.5 Admin role grant
DB Role is the source of truth (revocable, auditable). Bootstrap from an
ADMIN_EMAILS env var: on login, if the email is in ADMIN_EMAILS and the user
role is USER, promote to ADMIN plus AuditLog. Zero-DB-touch way to seed the
first admin while keeping the DB authoritative thereafter. Demotion is DB-only
(removing from env does NOT auto-demote — explicit admin action, logged).

### 3.6 Cross-subdomain transport — DECISION
Cookie on .peterna.com (chosen). Attributes:
  Set-Cookie: pna_session=TOKEN; Domain=.peterna.com; Path=/; HttpOnly; Secure;
              SameSite=Lax; Max-Age=2592000
Frontend fetch uses credentials include; API CORS returns
Access-Control-Allow-Origin https://app.peterna.com (exact, from allowlist) plus
Access-Control-Allow-Credentials true plus handles OPTIONS preflight in
proxy.ts.
Rejected bearer-token-in-localStorage: XSS-exfiltratable, and we would hand-roll
refresh. An HttpOnly cookie is strictly safer and the shared subdomain makes it
trivial.
CSRF: SameSite=Lax blocks the classic cross-site POST. Add a double-submit
token: API also sets a NON-HttpOnly pna_csrf cookie; the web client echoes it in
an X-CSRF-Token header on all mutating requests; API rejects mismatch. Cheap,
standard, defense-in-depth.

### 3.7 proxy.ts responsibilities (Next 16 — NOT middleware.ts)
- CORS preflight plus headers for the API app.
- Optimistic session check for redirect UX only (per Next 16 docs, proxy is NOT
  the authz boundary). Real authz is in each route handler via requireUser /
  requireAdmin helpers that hit the DB Session.

---

## 4. COMPLETE API SURFACE

Base URL https://api.peterna.com. Auth: P=public, U=user, A=admin.
Status: NEW / REUSE (ported as-is) / CHANGE (ported plus ownership/scoping).

### 4.1 Auth  /auth/*
| Method | Path | Auth | Status | Purpose |
|---|---|---|---|---|
| POST | /auth/register | P | NEW | create account, send verify email |
| POST | /auth/login | P | NEW | issue session cookie |
| POST | /auth/logout | U | NEW | revoke session |
| POST | /auth/verify | P | NEW | consume email-verify token |
| POST | /auth/forgot | P | NEW | send reset email (always 200) |
| POST | /auth/reset | P | NEW | set new password, revoke sessions |
| POST | /auth/resend-verify | U | NEW | re-send verify email (throttled) |

### 4.2 Current user  /me, /videos/*
| Method | Path | Auth | Status | Purpose / shape |
|---|---|---|---|---|
| GET | /me | U | NEW | id, email, name, role, emailVerified, status |
| PATCH | /me | U | NEW | update name; change-password sub-flow |
| GET | /videos | U | CHANGE (was GET /api/build) | list MY videos, indexed cols only |
| POST | /videos | U | CHANGE (was POST /api/build) | create draft, returns {id}; assertCanCreateVideo |
| GET | /videos/:id | U owner | CHANGE (was GET /api/build/[id]) | {id, state, stepIndex, status} |
| PUT | /videos/:id | U owner | CHANGE (was PUT /api/build/[id]) | overwrite state blob |
| DELETE | /videos/:id | U owner | NEW | soft delete (deletedAt) |
| POST | /videos/:id/duplicate | U owner | NEW | clone state into a new draft |
| POST | /videos/:id/publish | U owner | CHANGE (absorbs POST /api/tribute) | set shareSlug+publishedAt; assertCanPublish |
| POST | /videos/:id/unpublish | U owner | NEW | clear shareSlug |

### 4.3 Generation (ownership-scoped; today anonymous)
All become /videos/:id/... so ownership is checked once and videoId scopes the
Job plus the state write. Bodies are unchanged from today except they no longer
pass asset state around (the API reads/writes Video.state).
| Method | Path | Auth | Status | Maps from |
|---|---|---|---|---|
| POST | /videos/:id/jobs | U owner | CHANGE | unifies video/beat, video/music, video/narration, video/assemble, image/generate, image/edit, image/grid, card/render via {kind,...}, creates Job, returns {jobId} |
| GET | /videos/:id/jobs | U owner | NEW | list job statuses for this video |
| GET | /jobs/:jobId | U owner | CHANGE (was GET /api/video/status) | one job status+result |
| POST | /videos/:id/compose | U owner | CHANGE (was /api/video/compose) | local ffmpeg compose; long; returns Job or {url} |
| POST | /videos/:id/burn-captions | U owner | CHANGE (was /api/video/burn-captions) | per-beat caption burn |
| POST | /videos/:id/photos | U owner | CHANGE (was /api/photo/upload, /photo/import) | upload/import a source photo |
| POST | /videos/:id/audio | U owner | CHANGE (was /api/audio/upload) | upload music |
| POST | /gemini | U | REUSE | text gen (stateless; rate-limited, user-scoped) |
| POST | /webhooks/fal | P signed | NEW | fal completion callback, marks Job done |
| GET | /download | U owner or P published | REUSE | same-origin asset download proxy (allowlist unchanged) |

DESIGN NOTE for coder: existing routes already accept the relevant pieces of
state in request bodies (e.g. the beat route takes imageUrls, pet, etc.). The
CHANGE is: the API now LOADS those from Video.state server-side instead of
trusting the client to send them, and WRITES results back into Video.state. This
removes the client as the source of truth for asset URLs and is what lets the
dashboard/admin show "everything."

### 4.4 Public  /public/*
| Method | Path | Auth | Status | Purpose |
|---|---|---|---|---|
| GET | /public/videos/:slug | P | CHANGE (was tributes read) | published tribute for the share page (SSR-fetched by web) |

### 4.5 Admin  /admin/*  (all A; requireAdmin plus AuditLog every action)
| Method | Path | Purpose / shape |
|---|---|---|
| GET | /admin/metrics | dashboard KPIs (see section 6.1) |
| GET | /admin/users?q=&status=&sort=&page= | paginated users + counts |
| GET | /admin/users/:id | user + their videos + recent activity + sessions + orders |
| POST | /admin/users/:id/deactivate | status=DEACTIVATED + revoke all sessions |
| POST | /admin/users/:id/activate | status=ACTIVE |
| POST | /admin/users/:id/role | promote/demote (logged) |
| POST | /admin/users/:id/force-logout | revoke all sessions |
| GET | /admin/videos?q=&status=&userId=&page= | all videos across tenants |
| GET | /admin/videos/:id | FULL detail: parsed state, all jobs, all assets, owner, audit trail |
| GET | /admin/activity?actorId=&action=&from=&to=&page= | global audit log |
| GET | /admin/jobs?status=failed | job-queue health, failed generations |
| POST | /admin/jobs/:id/retry | requeue a failed generation |

---

## 5. USER DASHBOARD SPEC  (app.peterna.com/dashboard)

Routes: /dashboard (videos), /dashboard/settings, /dashboard/billing
(placeholder). Auth-gated; unauth redirects to /login?next=...

### 5.1 My Videos (default)
- Grid/list from GET /videos. Each card: thumbnail (Video.thumbnailUrl),
  petName, status badge, updatedAt (edited 2h ago).
- Status drives the primary action:
  - DRAFT/GENERATING: Resume, links to /builder?id=ID (existing resume path).
    GENERATING also shows a live progress chip (polls /videos/:id/jobs).
  - READY: Preview / Publish / Download.
  - PUBLISHED: View public page (/tribute/SLUG), Copy share link, Unpublish.
  - FAILED: Retry plus an error summary.
- Per-card menu: Duplicate, Delete (confirm; soft delete), Rename.
- Empty state: hero "Create your first tribute", calls POST /videos then opens
  /builder?id=. Mirrors the existing get-started CTA.
- Sort: recently edited (default), name, status. Client-side filter chips by
  status.

### 5.2 Account Settings
Name, email (verified badge; resend-verify if not), change password (current +
new), active sessions list with "log out everywhere".

### 5.3 Billing (placeholder, billing-ready)
Static section: current plan reads from Entitlement (empty today, shows "Free /
pay-per-video"). Displays the pricing tiers from /pricing as info. A disabled
Upgrade CTA. This is the EXACT mount point for the future Stripe flow — no layout
rework needed when billing lands.

### 5.4 Create-new flow
"New tribute" button (dashboard header + empty state) calls POST /videos then
redirects to /builder?id=NEWID. The builder lazy-create in usePersistBuild is
REMOVED for authed users (the Video row now exists before the wizard mounts);
usePersistBuild becomes a pure PUT to /videos/:id.

---

## 6. ADMIN DASHBOARD SPEC  (PRIORITY — complete)

Routes under app.peterna.com/admin, gated by requireAdmin (server-checked on
every API call; the web route also checks role==ADMIN from /me for UX). Admin
auth is the SAME session cookie, but every /admin/* handler independently calls
requireAdmin (DB Session to User.role). No separate admin login; separation is
by role + per-endpoint enforcement + full audit logging.

### 6.1 Overview / Home  (GET /admin/metrics)
KPI cards + charts:
- Total users, active vs deactivated, new signups (7d/30d).
- Videos: total, by status (DRAFT/GENERATING/READY/PUBLISHED/FAILED).
- Videos created over time, videos completed (published) over time (line chart).
- Generation success/failure rate (from Job rows, last 7/30d).
- Revenue placeholder (sum of Order PAID, equals 0 today; visible, inert).

### 6.2 Users  (GET /admin/users)
- Table: email, name, role, status, video count, lastLoginAt, createdAt.
- Search (email/name), filter (status, role), sort (createdAt, lastLoginAt,
  video count), pagination.
- Row actions: Activate/Deactivate (instant session revoke), View detail.
- Data: User + COUNT(videos) aggregate + lastLoginAt.

### 6.3 User detail  (GET /admin/users/:id)
- Account panel: all User fields, emailVerified, status, role, timestamps.
- Their videos (reuse the Video card list, links to admin video detail).
- Activity log (their AuditLog rows, timeline).
- Active sessions (ip, userAgent, lastSeenAt) with force-logout.
- Orders/entitlements (empty today; renders the billing-ready section).
- Actions: activate/deactivate, change role, force-logout, resend-verify.

### 6.4 Video detail (drill-in, everything)  (GET /admin/videos/:id)
- Owner (link to user), status, lifecycle timestamps, shareSlug + public link.
- Full parsed state blob rendered readably: pet profile, beats, all asset URLs
  (storyboard frames, beat videos, cards, music, narration, composed mp4),
  approvals, gate notes.
- Job history: every Job (kind, status, falRequestId, timings, errors) — the
  generation forensics view.
- Audit trail for this video.
- Admin actions: retry failed jobs, unpublish, soft-delete.

### 6.5 Global Activity log  (GET /admin/activity)
Filterable timeline (actor, action, target, date range) backed by AuditLog.
Actions logged everywhere: auth login/logout/register/reset, video
created/updated/published/deleted, job started/done/failed, all admin actions.

### 6.6 System health  (GET /admin/jobs?status=failed + queue view)
Job queue: counts by status, in-flight COMPOSE (the serialized local ffmpeg),
failed jobs with error + retry button. Recent fal failures. The compose
single-slot state surfaced as compose busy/free.

### 6.7 Analytics — funnel / gate drop-off
Derived from Video.stepIndex + AuditLog: how many videos reach each step group /
each gate (1 character sheet, 2 storyboard, 3 cinematography) vs drop off.
stepIndex maps to the steps.ts STEPS order, so a histogram of the furthest
stepIndex per video gives the funnel. No new tracking infra needed for v1.

---

## 7. MIGRATION & ROLLOUT PLAN

Principle: never break the LIVE anonymous builder during transition. Ship the API
split and auth behind the scenes; flip user-facing flows last.

### Phase 0 — Foundations (no user-visible change)
- Introduce monorepo / shared packages/db. Move the Prisma schema; add the new
  models via an ADDITIVE migration (User/Session/AuthToken/Job/AuditLog/Plan/
  Order/Entitlement) + extend Build into Video columns (all nullable/defaulted).
  Existing Build reads keep working (Video is a superset).
- Stand up apps/api as a SECOND deployment on a new pm2 process / box, sharing
  the same DATABASE_URL. Port the 19 existing handlers verbatim under new paths,
  keep the OLD paths live too (alias) so nothing breaks.
- Backfill script for legacy tributes into Video (PUBLISHED). Keep tributes
  readable.
- Risk: schema migration on the live DB. Mitigate: additive-only, prisma db push
  then generate (per the team runbook), test on staging (52.7.25.179) first.

### Phase 1 — Auth + API service live (parallel to anonymous builder)
- Ship /auth/*, /me, sessions, proxy CORS, ADMIN_EMAILS bootstrap.
- Frontend gets /login, /register, /verify, /reset, and a typed api-client
  pointing at api.peterna.com with credentials.
- The anonymous builder STILL WORKS at /builder against the old same-origin
  routes. New authed users get the new /videos/* paths. Both coexist.
- Risk: cross-subdomain cookie/CORS misconfig. Mitigate: verify on staging
  subdomains first; explicit origin allowlist; test preflight.

### Phase 2 — Dashboard + ownership cutover
- Ship /dashboard. New videos are created via POST /videos (owned).
- Builder switches to /videos/:id persistence + the durable Job model for
  generation. Anonymous ?id= drafts become CLAIMABLE on login.
- Flip the marketing CTAs to register, dashboard, then builder for the authed
  product. Keep a feature flag to fall back to anonymous if needed (the codebase
  already uses env-flag gating).
- Decommission the old anonymous same-origin API routes once traffic confirms
  the new paths carry everything. Drop the legacy tributes table.
- Risk: generation regressions from moving state to server. Mitigate: keep the
  request/response bodies of generation routes identical; only the
  read/write-state source changes; QA the full 26-step flow on staging.

### Phase 3 — Admin dashboard
Ship /admin/* API + UI. Audit logging is wired from Phase 1 onward so by Phase 3
there is real history to show.

### Phase 4 — Billing (LATER; explicitly out of scope now)
Slots in at the inert seam: implement assertCanCreateVideo / assertCanPublish
against Entitlement/Order; add Stripe checkout + /webhooks/stripe that writes
Order(PAID) + Entitlement. The dashboard billing placeholder (5.3) and admin
revenue card (6.1) become live. NO schema rework — Plan/Order/Entitlement already
exist. This is the single clean insertion point; everything upstream was built to
leave it open.

### Parallel-run mechanics
Both API path sets (old anonymous + new /videos) live simultaneously in Phases
1-2 behind the same deploy. A frontend feature flag chooses which the builder
uses. Roll back = flip the flag, no DB rollback needed (additive schema).

---

## 8. OPEN DECISIONS (with recommendations)

8.1 Monorepo now, or two app dirs sharing a path alias?
   Recommend: commit to a pnpm/turbo monorepo in Phase 0. The two-dir interim
   invites schema drift between deployments. If Phase-0 time is tight, the
   path-alias interim is acceptable ONLY with a single shared prisma/ dir.

8.2 Gate the builder on email verification, or only publishing?
   Recommend: let unverified users BUILD (reduce signup friction), gate PUBLISH
   on verified email. Confirm with user.

8.3 Transactional email provider (verify/reset emails).
   Recommend: SES (AWS creds already present) or Resend. Needs a sending domain
   + DKIM. User/devops call.

8.4 Rate-limit / session store backend.
   Recommend: Postgres-backed counters for v1 (no new infra). Add Redis only if
   login/job-poll volume warrants. Flag for devops.

8.5 Dedicated job worker (BullMQ/SQS) for compose.
   Recommend: DEFER. Inline serialized ffmpeg on the API box is fine at current
   scale. Revisit when concurrent composes queue too long. The Job table already
   models everything a worker would need, so the upgrade is non-breaking.

8.6 Where does the API service run?
   Recommend: its own EC2 box (or its own pm2 process + reverse-proxy vhost for
   api.peterna.com) because it needs ffmpeg + Node + the fal/AWS secrets and is
   the only thing that should hold them. The web app can go to a static-ish host
   since it holds no secrets. Devops call on exact placement; existing boxes:
   staging 52.7.25.179, builder 3.83.157.68.

8.7 Anonymous-draft retention.
   Recommend: sweep userId=NULL drafts after 30 days; preserve PUBLISHED
   tributes forever (the /pricing promise is hosted forever).

8.8 Thumbnail source.
   Recommend: set Video.thumbnailUrl from the first storyboard frame when it is
   generated (cheap, already an S3 URL). Avoid a separate poster-extraction job.
