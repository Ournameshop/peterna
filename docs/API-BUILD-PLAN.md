# peterna-api — Master Build Plan

Status: DESIGN (no code). Owner: architect. Consumers: backend, frontend, QA, devops, CTO.

Scope: a STANDALONE API service in its own git repo (`peterna-api`) that is the
backend for the peterna tribute-video product. Next.js 16 run API-only behind
pm2. Provides email+password auth, per-user video ownership, ownership-scoped
generation, a complete admin dashboard surface, full audit logging, and — NEW IN
THIS REVISION — a complete Stripe billing system.

This document supersedes `PRODUCT-ARCHITECTURE.md` on two points and inherits the
rest. Read that doc for the deeper rationale on session strategy, the Job model,
and the legacy-data migration; this doc restates those decisions concretely for a
separate repo and adds the full payments design.

---

## 0. WHAT CHANGED FROM THE BLUEPRINT (read first)

The prior blueprint assumed a MONOREPO with billing DEFERRED. Two decisions are
now different and this plan reflects them throughout:

1. **Separate repo, not monorepo.** `peterna-api` is its own git repo and its own
   Next.js 16 API-only app. The existing builder repo is left UNTOUCHED — it keeps
   its same-origin routes and its `Build`/`tributes` stores running exactly as
   today. The frontend talks to `peterna-api` over HTTPS. The only shared surface
   is the `BuilderState` type plus the API DTOs (see section 1.3). Crucially:
   `peterna-api` gets its OWN database (its own `DATABASE_URL`), not a shared
   connection into the builder's DB. Legacy data is backfilled by a one-time
   script (section 2.7), not by sharing a live connection.

2. **Payments are in scope.** Section 5 is a complete Stripe design: real tiers
   mapped to Stripe products/prices, Checkout vs Payment Element decision, full
   purchase / subscription / renewal / dunning / refund flows, the webhook
   handler, the entitlement-backed `assertCanPublish` policy seam, and how admin
   MRR analytics derive from these tables.

Everything else from the blueprint — opaque DB-backed sessions, the cross-
subdomain cookie, argon2id, the `Video` ownership model absorbing `Build`, the
durable `Job` rows, the admin spec, the audit taxonomy — carries forward.

---

## 1. REPO STRUCTURE & TOPOLOGY

### 1.1 Deployments

```
app.peterna.com   (existing builder repo, UNCHANGED + new dashboard/admin UI later)
      |  HTTPS, fetch(credentials:'include')
      v
api.peterna.com   (peterna-api — THIS repo) — the trust boundary, holds ALL secrets
      |
      v
Postgres (peterna_api DB)  +  S3  +  fal/Suno/Gemini  +  Stripe  +  SES
```

The API service is the SOLE writer of the new database, the sole holder of
fal/Suno/Gemini/AWS/Stripe/SES secrets, and the only thing that runs local ffmpeg
(compose). The frontend holds no secrets and never touches Postgres.

### 1.2 Directory tree (Next.js 16, API-only, webpack, standalone output)

```
peterna-api/
  app/
    auth/        register login logout verify resend-verify forgot reset (each route.ts, POST)
    me/
      route.ts                     GET, PATCH
      password/route.ts            POST
      sessions/route.ts            GET
      sessions/[id]/route.ts       DELETE (one, or "all")
      reactivate/route.ts          POST
    videos/
      route.ts                     GET (list mine), POST (create draft)
      [id]/route.ts                GET, PUT (state), DELETE (soft)
      [id]/duplicate/route.ts      POST
      [id]/publish/route.ts        POST
      [id]/unpublish/route.ts      POST
      [id]/jobs/route.ts           GET (list), POST (enqueue generation)
      [id]/compose/route.ts        POST   (local ffmpeg, long)
      [id]/burn-captions/route.ts  POST
      [id]/photos/route.ts         POST
      [id]/audio/route.ts          POST
      [id]/checkout/route.ts       POST   (buy a one-time tier for THIS video)
    jobs/[id]/route.ts             GET    (one job status+result)
    gemini/route.ts                POST   (stateless text gen, user-scoped)
    download/route.ts              GET    (same-origin asset proxy, allowlist)
    billing/
      plans/route.ts          GET    (catalog: tiers + channel plans)
      checkout/route.ts       POST   (subscription / lifetime checkout session)
      portal/route.ts         POST   (Stripe Billing Portal session)
      subscription/route.ts   GET    (my Family Channel status)
      history/route.ts        GET    (my orders + invoices)
    webhooks/
      stripe/route.ts         POST   (signed; raw body)
      fal/route.ts            POST   (signed; fal completion fast-path)
    public/videos/[slug]/route.ts  GET  (published tribute for the share page)
    admin/
      metrics/route.ts        GET
      users/route.ts          GET
      users/[id]/route.ts     GET
      users/[id]/activate|deactivate|suspend|unsuspend|role|force-logout/route.ts  POST
      videos/route.ts         GET
      videos/[id]/route.ts    GET
      videos/[id]/unpublish|delete/route.ts  POST
      activity/route.ts       GET
      jobs/route.ts           GET
      jobs/[id]/retry/route.ts            POST
      billing/orders|subscriptions|invoices/route.ts  GET
      billing/refund/route.ts             POST
  lib/
    server/
      prisma.ts        singleton PrismaClient
      auth.ts          requireUser / requireAdmin / requireOwner; session issue+validate; argon2
      tokens.ts        AuthToken create/verify (email-verify, password-reset), CSRF
      ratelimit.ts     per-IP / per-email throttle (Postgres-backed counters)
      jobs.ts          Job lifecycle: enqueue, poll fal, rehost, write Video.state
      storage.ts       PORTED from builder (S3 rehost, SSRF guard) — unchanged
      fal.ts suno.ts   PORTED clients
      stripe.ts        Stripe client + helpers (customer ensure, checkout, refund)
      entitlements.ts  assertCanCreateVideo / assertCanPublish / hasFamilyChannel
      email.ts         SES (or Resend) transactional send
      audit.ts         writeAudit(action, actor, target, meta)
      prompts.ts subtitles.ts  PORTED
      cors.ts          origin allowlist helper used by proxy.ts + handlers
    dto.ts             zod schemas + inferred request/response types (the contract)
    builder-state.ts   the BuilderState type, SYNCED from the builder repo (1.3)
  prisma/  schema.prisma  migrations/  seed.ts (Plan rows + dev admin)
  scripts/ backfill-tributes.ts  sweep-sessions.ts
  proxy.ts             Next 16 proxy: CORS preflight + headers, optimistic redirect only
  next.config.ts       output:'standalone', webpack (no turbopack)
  ecosystem.config.js  pm2 process def
  .env.example
```

### 1.3 The shared contract problem (separate repo) — DECISION

Two repos must agree on (a) the `BuilderState` shape stored in `Video.state`, and
(b) the request/response DTOs the frontend calls.

**Decision: API treats `state` as largely opaque JSON, plus ONE synced types file.**

- The API stores `Video.state` as a `Json` blob and DOES NOT query or validate
  individual `BuilderState` fields (the builder's own `state.ts` comment confirms
  there are no cross-field queries — that property is the whole reason the blob
  approach works). The API reads specific paths only where generation needs them
  (e.g. `state.petPhotos[].url`, `state.storyboardImages[i]`) and writes results
  back. It validates `state` with a LOOSE zod schema ("is an object, optional known
  top-level keys") — never a strict full mirror. A new `BuilderState` field added
  in the builder repo does NOT require an API deploy.
- For type-checking, vendor a single `lib/builder-state.ts` that is a COPY of the
  builder's `src/app/builder/state.ts` type declarations (types only). Keep it in
  sync with a tiny CI check: fetch the builder repo's `state.ts`, extract the
  `BuilderState` interface, diff against the vendored copy; fail CI on drift.
  Cheaper than publishing an npm package for two repos owned by one team, and the
  loose-validation rule means drift is non-fatal at runtime.
- The DTOs (`lib/dto.ts`) are owned by the API. The frontend hand-writes a typed
  `api-client.ts` against section 6. If DTO churn becomes painful, promote
  `lib/dto.ts` to a private package (`@peterna/api-types`) — not on day one.

**Tradeoff accepted:** a vendored types copy can drift. Mitigated by loose runtime
schema (drift is not a crash) + a CI drift check (drift is visible). The
alternative — a published shared package — adds release ceremony for two repos one
team controls. Not worth it yet.

### 1.4 Stack decision — JUSTIFIED (carried from blueprint)

Next.js 16, API-only, standalone output, pm2 on EC2. Zero-rewrite port of the
existing fal/Suno/storage/prompts/subtitle libs and generation handlers (already
`Request -> NextResponse` functions); same deploy muscle (`prisma db push` +
`generate` pre-build, pm2); route handlers give `runtime='nodejs'`, `maxDuration`,
streaming responses for free (needed by `/download` + compose). Rejected
Fastify/Express/Nest: rewriting working handlers + multipart + streaming for zero
gain at ~30-endpoint, ~50-order scale. Decoupling is a deployment split + CORS,
orthogonal to runtime.

### 1.5 proxy.ts (Next 16 — NOT the authz boundary)

Per Next 16 docs, `proxy.ts` replaces `middleware.ts` and is NOT where authz lives.
Its only jobs: CORS (answer OPTIONS preflight; set exact `Allow-Origin` from the
allowlist, never `*`; `Allow-Credentials: true`; allowed methods/headers incl
`X-CSRF-Token`); optional optimistic redirect (mostly a no-op for an API). Real
authz is per-handler (`requireUser/Owner/Admin` hit the DB Session) + per-mutation
CSRF. `/webhooks/*` are CORS- and CSRF-exempt (server-to-server, signed).

---

## 2. DATA MODEL (Prisma)

One schema, one new database (`peterna_api`). Sketch — backend finalizes syntax.

### 2.1 Identity & sessions

```prisma
model User {
  id               String     @id @default(cuid())
  email            String     @unique            // stored lowercased
  passwordHash     String                         // argon2id
  name             String?
  role             Role       @default(USER)
  status           UserStatus @default(PENDING)   // see section 4
  statusReason     String?
  statusChangedAt  DateTime?
  statusChangedBy  String?                         // actor userId, or "system"
  emailVerified    DateTime?                       // null = unverified
  stripeCustomerId String?    @unique              // set lazily on first checkout
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt
  lastLoginAt      DateTime?
  sessions       Session[]
  videos         Video[]
  tokens         AuthToken[]
  orders         Order[]
  subscriptions  Subscription[]
  entitlements   Entitlement[]
  payments       Payment[]
  auditLogs      AuditLog[]  @relation("ActorLogs")
  @@index([status])
  @@index([createdAt])
  @@index([stripeCustomerId])
}
enum Role { USER ADMIN }
enum UserStatus {
  PENDING       // email unverified; can log in + build, cannot publish
  ACTIVE        // verified, full access
  DEACTIVATED   // reversible: self-service or admin; login blocked
  SUSPENDED     // admin punitive (abuse/chargeback); login blocked, public videos hidden
}

model Session {
  id String @id @default(cuid())
  userId String
  user User @relation(fields:[userId], references:[id], onDelete:Cascade)
  tokenHash String @unique         // SHA-256 of the random cookie value
  createdAt DateTime @default(now())
  expiresAt DateTime                // sliding 30d
  lastSeenAt DateTime @default(now())
  ip String?
  userAgent String?
  revokedAt DateTime?               // logout / state change / force-logout
  @@index([userId])
  @@index([expiresAt])
}

model AuthToken {
  id String @id @default(cuid())
  userId String
  user User @relation(fields:[userId], references:[id], onDelete:Cascade)
  kind AuthTokenKind               // EMAIL_VERIFY | PASSWORD_RESET
  tokenHash String @unique         // SHA-256 of the emailed token
  expiresAt DateTime
  consumedAt DateTime?
  createdAt DateTime @default(now())
  @@index([userId, kind])
}
enum AuthTokenKind { EMAIL_VERIFY PASSWORD_RESET }
```

### 2.2 Video, Job, Audit

```prisma
model Video {
  id String @id @default(cuid())
  userId String?                          // nullable only for backfilled legacy rows
  user User? @relation(fields:[userId], references:[id])
  petName String?
  status VideoStatus @default(DRAFT)
  stepIndex Int @default(0)
  thumbnailUrl String?
  finalVideoUrl String?
  durationSec Int?
  state Json                              // entire BuilderState blob (opaque, 1.3)
  shareSlug String? @unique               // public URL token
  publishedAt DateTime?
  openingText String?
  closingText String?
  years String?
  creatorName String?
  tier String?                            // plan code of the one-time purchase that unlocked it
  orderId String? @unique                 // the Order that paid for this video (1:1)
  order Order? @relation(fields:[orderId], references:[id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?                      // soft delete (user)
  takenDownAt DateTime?                    // admin moderation takedown
  jobs Job[]
  auditLogs AuditLog[]
  @@index([userId, status])
  @@index([updatedAt])
  @@index([status])
  @@index([shareSlug])
  @@index([orderId])
}
enum VideoStatus { DRAFT GENERATING READY PUBLISHED ARCHIVED FAILED }

model Job {
  id String @id @default(cuid())
  videoId String
  video Video @relation(fields:[videoId], references:[id], onDelete:Cascade)
  kind JobKind
  status JobStatus @default(QUEUED)
  beatIndex Int?
  falEndpoint String?
  falRequestId String?
  input Json?
  result Json?                            // { url, ... }
  error String?
  attempts Int @default(0)
  createdAt DateTime @default(now())
  startedAt DateTime?
  finishedAt DateTime?
  @@index([videoId])
  @@index([status])
  @@index([falRequestId])
}
enum JobKind { BEAT MUSIC NARRATION ASSEMBLE COMPOSE IMAGE CARD GEMINI }
enum JobStatus { QUEUED RUNNING DONE FAILED }

model AuditLog {
  id String @id @default(cuid())
  actorId String?                         // null = system / webhook
  actor User? @relation("ActorLogs", fields:[actorId], references:[id])
  videoId String?
  video Video? @relation(fields:[videoId], references:[id])
  action String                           // taxonomy in section 8
  targetType String?                      // user | video | order | subscription | session
  targetId String?
  metadata Json?
  ip String?
  createdAt DateTime @default(now())
  @@index([actorId, createdAt])
  @@index([action, createdAt])
  @@index([targetType, targetId])
  @@index([createdAt])
}
```

### 2.3 Payments — Plan

```prisma
model Plan {
  id String @id @default(cuid())
  code String @unique     // instant, essential, premium, elite, family_monthly, family_annual, family_lifetime
  name String
  kind PlanKind           // ONE_TIME | SUBSCRIPTION
  priceCents Int          // 9900,14900,29500,59500,995,8900,24900
  currency String @default("usd")
  interval PlanInterval?  // MONTH | YEAR | null (one-time / lifetime)
  stripeProductId String?
  stripePriceId String? @unique
  active Boolean @default(true)
  sortOrder Int @default(0)
  metadata Json?          // feature list, max images, max duration
  orders Order[]
  subscriptions Subscription[]
  @@index([kind, active])
}
enum PlanKind { ONE_TIME SUBSCRIPTION }
enum PlanInterval { MONTH YEAR }
```

Note on `family_lifetime`: a ONE-TIME purchase granting perpetual Family Channel.
Model `kind=ONE_TIME, interval=null`; on purchase write
`Entitlement(kind=FAMILY_CHANNEL, endsAt=null)`, not a Subscription row (see 5.4).

### 2.4 Payments — Order (one-time buys: tiers + lifetime)

```prisma
model Order {
  id String @id @default(cuid())
  userId String
  user User @relation(fields:[userId], references:[id])
  planCode String
  plan Plan @relation(fields:[planCode], references:[code])
  amountCents Int                          // snapshot of price at purchase
  currency String @default("usd")
  status OrderStatus @default(PENDING)
  videoId String?                          // one-time TIER buys attach to a video
  stripeCheckoutId String? @unique         // cs_...
  stripePaymentIntentId String? @unique    // pi_...
  receiptUrl String?
  createdAt DateTime @default(now())
  paidAt DateTime?
  refundedAt DateTime?
  payments Payment[]
  refunds Refund[]
  video Video? @relation
  @@index([userId])
  @@index([status])
  @@index([planCode])
}
enum OrderStatus { PENDING PAID REFUNDED PARTIALLY_REFUNDED FAILED CANCELED }
```

`Order.video` <-> `Video.order` is a 1:1 relation (`Video.orderId @unique`). One
tier purchase unlocks exactly one video — the join `assertCanPublish(video)`
checks (5.6).

### 2.5 Payments — Subscription (Family Channel: monthly / annual)

```prisma
model Subscription {
  id String @id @default(cuid())
  userId String
  user User @relation(fields:[userId], references:[id])
  planCode String                          // family_monthly | family_annual
  plan Plan @relation(fields:[planCode], references:[code])
  status SubscriptionStatus @default(INCOMPLETE)
  stripeSubscriptionId String @unique      // sub_...
  stripeCustomerId String
  currentPeriodEnd DateTime?
  cancelAtPeriodEnd Boolean @default(false)
  canceledAt DateTime?
  trialEnd DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  payments Payment[]
  @@index([userId])
  @@index([status])
  @@index([currentPeriodEnd])
}
enum SubscriptionStatus { TRIALING ACTIVE PAST_DUE CANCELED INCOMPLETE INCOMPLETE_EXPIRED UNPAID }
```

### 2.6 Payments — Entitlement, Payment (ledger), Refund, WebhookEvent

`Entitlement` is the SINGLE thing the policy layer reads (5.6). Written by webhook
handlers, never trusted from the client. It decouples "what Stripe says" from
"what the product grants," so admin grants and lifetime buys slot in uniformly.

```prisma
model Entitlement {
  id String @id @default(cuid())
  userId String
  user User @relation(fields:[userId], references:[id])
  kind EntitlementKind                     // PUBLISH_VIDEO | FAMILY_CHANNEL
  planCode String?
  videoId String?                          // PUBLISH_VIDEO scoped to one video
  source String                            // order:<id> | subscription:<id> | admin_grant:<adminId>
  startsAt DateTime @default(now())
  endsAt DateTime?                          // null = perpetual (lifetime / one-time publish)
  revokedAt DateTime?                       // refund / admin revoke / sub canceled
  createdAt DateTime @default(now())
  @@index([userId, kind])
  @@index([videoId])
  @@index([endsAt])
}
enum EntitlementKind { PUBLISH_VIDEO FAMILY_CHANNEL }

// Immutable money ledger — one row per Stripe payment event, for the admin ledger.
model Payment {
  id String @id @default(cuid())
  userId String
  user User @relation(fields:[userId], references:[id])
  orderId String?
  order Order? @relation(fields:[orderId], references:[id])
  subscriptionId String?
  subscription Subscription? @relation(fields:[subscriptionId], references:[id])
  amountCents Int
  currency String @default("usd")
  status PaymentStatus                      // SUCCEEDED | FAILED | REFUNDED
  stripePaymentIntentId String?
  stripeInvoiceId String? @unique           // subscription invoices
  stripeChargeId String?
  receiptUrl String?
  failureReason String?
  createdAt DateTime @default(now())
  @@index([userId])
  @@index([orderId])
  @@index([subscriptionId])
  @@index([status, createdAt])
  @@index([createdAt])
}
enum PaymentStatus { SUCCEEDED FAILED REFUNDED }

model Refund {
  id String @id @default(cuid())
  orderId String
  order Order @relation(fields:[orderId], references:[id])
  amountCents Int
  reason String?                            // admin note
  stripeRefundId String @unique             // re_...
  issuedBy String                            // admin userId
  createdAt DateTime @default(now())
  @@index([orderId])
}

// Webhook idempotency — dedupe Stripe event ids (5.5).
model WebhookEvent {
  id String @id                             // Stripe event id (evt_...) is the PK
  type String
  processedAt DateTime @default(now())
  @@index([type])
}
```

### 2.7 Legacy data & no shared DB

`peterna-api` has its OWN database (not the builder's), so there is no live schema
migration on the builder's DB and no risk to the running anonymous flow.

- **Legacy `tributes` (raw-pg, public share pages):** one-time
  `backfill-tributes.ts` reads the builder DB's `tributes` table (read-only conn
  string passed as a script arg) and inserts one `Video` per row into the API DB:
  `status=PUBLISHED, shareSlug = old tributes.id` (preserves existing
  `/tribute/<uuid>` URLs), `userId=NULL` (orphan), copying
  `petName/finalVideoUrl/openingText/closingText/years/creatorName`. Hosted
  forever; never swept.
- **Legacy Prisma `Build` drafts:** anonymous, low value — do NOT backfill. New
  drafts are created fresh via `POST /videos`. The builder repo keeps serving its
  own `Build` rows for the legacy anonymous flow until retired (frontend decision).
- **Anonymous drafts in the new DB:** the new API requires auth to create a
  `Video`, so there are none to sweep.

### 2.8 Indexing rationale
- `Video(userId,status)` dashboard query; `Video(shareSlug)` O(1) public lookup;
  `Video(updatedAt)` admin recency; `Video(orderId)` entitlement join.
- `Session(tokenHash unique)` one indexed lookup per request; `Session(expiresAt)`
  cron sweep.
- `Order(status)`, `Payment(status,createdAt)`, `Subscription(status)` admin ledger
  filters + revenue aggregates; `Subscription(currentPeriodEnd)` dunning + churn.
- `Entitlement(userId,kind)` + `(videoId)` the hot path for every
  `assertCanPublish`; `(endsAt)` expiry sweep.
- `AuditLog(action,createdAt)` + `(actorId,createdAt)` + `(targetType,targetId)`
  admin timeline/filter. `WebhookEvent(id PK)` idempotency dedupe.

---

## 3. AUTH (email + password) — concrete for this repo

### 3.1 Hashing
argon2id (`argon2` npm, native). Params m=19456 KiB, t=2, p=1 (OWASP baseline);
tune on the box. Reject bcrypt (72-byte truncation).

### 3.2 Flows
- **Register** `POST /auth/register {email,password,name}`: zod-validate, lowercase
  email, uniqueness check, argon2id hash, create `User(status=PENDING,
  emailVerified=null)`, create `EMAIL_VERIFY` token (24h TTL), email
  `app.peterna.com/verify?token=`. Returns 201 and ISSUES a session immediately
  (PENDING users can log in + build; just cannot publish — section 4).
- **Verify** `POST /auth/verify {token}`: hash, find unconsumed/unexpired token,
  set `emailVerified=now`, transition `PENDING -> ACTIVE`, consume token.
- **Login** `POST /auth/login {email,password,reactivate?}`: find user; if none,
  run a dummy argon2 verify to equalize timing (no enumeration); `argon2.verify`;
  branch on status (4.3); create `Session`; `Set-Cookie`. Generic failure msg.
  Apply ADMIN_EMAILS bootstrap (3.5).
- **Logout** `POST /auth/logout`: set `Session.revokedAt`, clear cookie.
- **Forgot** `POST /auth/forgot {email}`: always 200; if user exists create
  `PASSWORD_RESET` token (15-min TTL), email link.
- **Reset** `POST /auth/reset {token,newPassword}`: verify token, set new hash,
  REVOKE ALL sessions, consume token.
- **Resend-verify** `POST /auth/resend-verify` (U, throttled).
- **Me** `GET /me` -> user or 401. `PATCH /me` name. `POST /me/password` current+new
  (re-verify current; revoke other sessions).

### 3.3 Sessions
Opaque 256-bit random token, SHA-256 hashed at rest. NOT JWT — admin must revoke
instantly (deactivate/suspend/force-logout); a stateless JWT cannot be revoked
before expiry. 30-day sliding expiry; refresh `expiresAt`+`lastSeenAt` on use,
throttled once/hour to avoid write amplification. Rotate token on password reset
and role change. Cron sweeps expired + revoked-older-than-7d.

### 3.4 Rate limiting / brute force
Postgres-backed counter (no new infra): per-IP + per-email throttle on
`/auth/login` and `/auth/forgot` (5 / 15 min, exponential backoff). Global per-IP
cap on `/auth/register`. Generic errors + constant-time compares. Flag Redis later.

### 3.5 Admin bootstrap
DB `Role` is the source of truth (revocable, auditable). On login, if the email is
in `ADMIN_EMAILS` and the user's role is USER, promote to ADMIN + audit
`admin.role.granted`. Removing an email from env does NOT auto-demote (explicit
admin action only).

### 3.6 Cross-subdomain cookie + CSRF
```
Set-Cookie: pna_session=<token>; Domain=.peterna.com; Path=/; HttpOnly; Secure;
            SameSite=Lax; Max-Age=2592000
```
Frontend `fetch(..., {credentials:'include'})`. API CORS returns the EXACT origin
from the allowlist + `Allow-Credentials: true`; never `*` with credentials. CSRF:
`SameSite=Lax` blocks the classic cross-site POST; add double-submit (non-HttpOnly
`pna_csrf` cookie echoed in `X-CSRF-Token` header on every mutation; reject
mismatch). `/webhooks/*` exempt. Rejected bearer-in-localStorage: XSS-exfiltratable;
an HttpOnly cookie on the shared subdomain is strictly safer.

---

## 4. USER STATE MACHINE & SUSPENSIONS (complete)

Four states. Every transition writes an `AuditLog` and (where noted) revokes
sessions. `statusReason/statusChangedAt/statusChangedBy` record why/who.

### 4.1 States

| State | Meaning | Log in? | API access | Existing sessions | Public videos |
|---|---|---|---|---|---|
| PENDING | Registered, email unverified | Yes | Full EXCEPT publish/checkout | Kept | (none yet) |
| ACTIVE | Verified | Yes | Full | Kept | Visible |
| DEACTIVATED | Reversible close (self/admin) | No (until reactivate) | None (401 + reactivation hint) | REVOKED | Visible (hosted forever) |
| SUSPENDED | Punitive (abuse/chargeback) | No | None (403 + support) | REVOKED | HIDDEN (public 404s) |

### 4.2 Transitions
- `PENDING -> ACTIVE`: email verification (system, on token consume).
- `* -> DEACTIVATED`: user (self-service `PATCH /me {deactivate:true}`) OR admin
  (`/deactivate`).
- `DEACTIVATED -> ACTIVE`: admin (`/activate`) OR self-reactivation on login
  (DEACTIVATED is user-reversible). A PENDING user who deactivated before verifying
  returns to PENDING, not ACTIVE.
- `* -> SUSPENDED`: admin ONLY (`/suspend`), requires `statusReason`.
- `SUSPENDED -> ACTIVE`: admin ONLY (`/unsuspend`). A suspended user can NEVER
  self-reactivate.

### 4.3 Enforcement (where each check lives)
- **Login**: after password verify, branch on status:
  - PENDING/ACTIVE -> issue session.
  - DEACTIVATED -> if body lacks `reactivate:true`, return
    `409 {code:"DEACTIVATED", reactivatable:true}` and NO session. If
    `reactivate:true`, flip to ACTIVE (or PENDING if never verified) + issue session
    + audit `user.status.reactivated_self`.
  - SUSPENDED -> `403 {code:"SUSPENDED"}`, never a session.
- **`requireUser()`** (every protected route): loads session -> user; if not
  PENDING/ACTIVE treat the session as invalid (defense-in-depth) -> 401/403. PENDING
  passes here; publish/checkout gate PENDING separately.
- **Publish & checkout** gate on `emailVerified != null` (status==ACTIVE):
  `assertCanPublish` + checkout return `403 {code:"EMAIL_UNVERIFIED"}` for PENDING.
  Rationale: let people BUILD immediately (low friction), block spammy PUBLIC pages
  and payment until verified.
- **Public route** `/public/videos/:slug`: if the owning user is SUSPENDED, 404
  (hide). DEACTIVATED owners' published tributes stay visible — "hosted forever,"
  and deactivation is benign.

### 4.4 Session revocation per transition
- `-> DEACTIVATED` / `-> SUSPENDED`: revoke ALL the user's sessions.
- reactivations: no session to restore; fresh login.
- Admin `force-logout` (no status change): revoke ALL sessions; status unchanged.

### 4.5 Suspension vs subscriptions — DECISION
**Suspension blocks access but does NOT auto-cancel the Stripe subscription.** An
abuse/chargeback flag is an access decision, separable from billing; auto-canceling
could forfeit money owed or complicate a dispute, and Stripe dunning continues
independently. The admin has a separate explicit cancel action if warranted.
DEACTIVATION likewise does not auto-cancel — but the self-service close-account UI
should prompt the user to cancel Family Channel first, and if confirmed the API
cancels it `at_period_end` before deactivating. Net rule: state changes NEVER
silently cancel billing; cancellation is always an explicit, separately-audited
action.

### 4.6 Audit
Every transition writes `AuditLog(action, actorId, targetType:"user", targetId,
metadata:{from,to,reason})`: `user.status.activated/.deactivated/.suspended/
.unsuspended/.reactivated_self`, `admin.user.force_logout`.

---

## 5. PAYMENTS (Stripe) — full design

### 5.1 Pricing -> Stripe mapping
One Stripe Product per item, one Price per product (one-time tiers + lifetime use a
one-time price; monthly/annual use recurring prices). Seed Plan rows mirroring.

| Plan code | Group | Stripe price kind | Amount | Plan.kind / interval |
|---|---|---|---|---|
| instant | tier | one-time | $99 (9900) | ONE_TIME / null |
| essential | tier | one-time | $149 (14900) | ONE_TIME / null |
| premium | tier | one-time | $295 (29500) | ONE_TIME / null |
| elite | tier | one-time | $595 (59500) | ONE_TIME / null |
| family_monthly | channel | recurring monthly | $9.95 (995) | SUBSCRIPTION / MONTH |
| family_annual | channel | recurring yearly | $89 (8900) | SUBSCRIPTION / YEAR |
| family_lifetime | channel | one-time | $249 (24900) | ONE_TIME / null |

elite includes "First year of Family Channel" — grant a FAMILY_CHANNEL entitlement
endsAt = now + 1 year on elite purchase (NOT a Stripe subscription; a bundled
grant). At year-end the user converts via the normal flow (no auto-charge).

GET /billing/plans serves the live catalog so /pricing + dashboard read live data
(price/feature changes need no frontend deploy). Plan.metadata holds the feature
bullets, max images, max duration per tier.

### 5.2 Checkout vs Payment Element — DECISION: Stripe Checkout (hosted)
- PCI scope: hosted Checkout keeps card data on Stripe's domain -> SAQ A, the
  smallest burden. Payment Element is still SAQ A but puts the card iframe on our
  origin and needs more wiring.
- Speed to build: Checkout handles 3DS/SCA, wallets, receipts, and the
  subscription-create dance out of the box (~10 lines + a redirect).
- UX: the hosted page is polished/localized; the redirect cost is negligible for a
  low-frequency, high-consideration purchase (a memorial). Not an impulse funnel.
- Billing management: pair with the Stripe Billing Portal (hosted) for manage/
  update-card/cancel — zero UI to build.

Tradeoff accepted: less control over checkout look + a redirect off-domain.
Acceptable: the buy is deliberate; trade pixel control for near-zero PCI and
integration risk. Revisit Payment Element only if data shows the redirect hurts.

### 5.3 Flow — one-time tier purchase unlocks a video
```
[web] POST /videos/:id/checkout {planCode:"premium"}
  API: requireOwner; assert video publishable-state (READY / has final);
       ensure stripeCustomerId; create Order(PENDING, planCode, videoId, amount);
       stripe.checkout.sessions.create({ mode:'payment', customer,
         line_items:[plan.stripePriceId],
         metadata:{orderId,videoId,userId,planCode}, success_url, cancel_url })
  201 {checkoutUrl}  -> redirect (Stripe hosted) -> user pays
[Stripe] /webhooks/stripe : checkout.session.completed
  API: verify sig; dedupe event id; load Order by metadata.orderId;
       Order.status=PAID, paidAt, stripePaymentIntentId, receiptUrl;
       Payment(SUCCEEDED);
       Entitlement(kind=PUBLISH_VIDEO, videoId, endsAt=null, source=order:<id>);
       Video.tier=planCode, Video.orderId=<id>;
       email receipt; AuditLog billing.order.paid
[web] success page GET /videos/:id -> now publishable; user publishes
```
Publishing (POST /videos/:id/publish) calls assertCanPublish -> checks for a
non-revoked PUBLISH_VIDEO entitlement on that videoId (5.6).

### 5.4 Flow — Family Channel subscription (and lifetime)
```
SUBSCRIPTION (monthly/annual):
[web] POST /billing/checkout {planCode:"family_annual"}
  API: requireUser(ACTIVE); ensure customer; checkout.sessions.create({
       mode:'subscription', line_items:[plan.stripePriceId],
       metadata:{userId,planCode}, urls }) -> 201 {checkoutUrl} -> redirect
[Stripe] checkout.session.completed (mode=subscription)
  API: upsert Subscription(ACTIVE, stripeSubscriptionId, currentPeriodEnd,
       cancelAtPeriodEnd=false); Entitlement(FAMILY_CHANNEL, endsAt=currentPeriodEnd,
       source=subscription:<id>); Payment(SUCCEEDED) from the invoice; receipt.
[Stripe] invoice.paid (each renewal) -> extend currentPeriodEnd, refresh
       Entitlement.endsAt, Payment(SUCCEEDED).

LIFETIME (one-time):
[web] POST /billing/checkout {planCode:"family_lifetime"}
  API: mode:'payment'. On checkout.session.completed: Order(PAID);
       Entitlement(FAMILY_CHANNEL, endsAt=null, source=order:<id>);
       NO Subscription row; Payment(SUCCEEDED).
```

### 5.5 Webhook design — /webhooks/stripe
- Raw body + signature: read raw body (Next 16 await req.text()), verify with
  stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET). Reject on
  failure (400). CSRF/CORS-exempt.
- Idempotency: first thing after sig-verify — INSERT WebhookEvent(id=event.id); if
  it exists, return 200 (already processed). Stripe retries; handlers idempotent.
  DB writes for one event run in a single transaction with the WebhookEvent insert.

| Event | Writes |
|---|---|
| checkout.session.completed | Branch on mode: payment -> finalize Order(PAID), Payment, Entitlement (PUBLISH_VIDEO, or FAMILY_CHANNEL for lifetime), link Video. subscription -> create Subscription(ACTIVE), FAMILY_CHANNEL Entitlement. |
| invoice.paid | Renewal: extend currentPeriodEnd, refresh Entitlement.endsAt, Payment(SUCCEEDED), set ACTIVE if was PAST_DUE. |
| invoice.payment_failed | Subscription.status=PAST_DUE, Payment(FAILED, failureReason), dunning email. Entitlement NOT yet revoked (grace). |
| customer.subscription.updated | Sync status, currentPeriodEnd, cancelAtPeriodEnd, canceledAt, trialEnd. If canceled/unpaid, revoke or let FAMILY_CHANNEL Entitlement lapse at endsAt. |
| customer.subscription.deleted | Subscription.status=CANCELED, canceledAt; FAMILY_CHANNEL entitlement lapses at period end. |
| charge.refunded | Refund row, Payment.status=REFUNDED, Order.status=REFUNDED/PARTIALLY_REFUNDED; revoke the related Entitlement (refunded tier -> unpublish, 5.7c). |
| charge.dispute.created (chargeback) | Flag for admin (audit + alert). Recommend admin then SUSPEND the user (4.5) + revoke entitlement. Not auto. |
| customer.subscription.trial_will_end | (optional) reminder email. |

Each handler writes a billing.* AuditLog (actorId=null/system). Slow side-effects
(email) fire-and-forget after the DB transaction commits.

### 5.6 The policy seam — entitlement-backed
lib/server/entitlements.ts is the ONLY place gating logic lives:
```
assertCanCreateVideo(user):
  if user.status not in {PENDING, ACTIVE} -> 403
  // optional soft cap on concurrent unpaid drafts (e.g. 20)
assertCanPublish(video, user):
  if user.emailVerified == null -> 403 EMAIL_UNVERIFIED
  ent = Entitlement where userId=video.userId AND kind=PUBLISH_VIDEO
        AND videoId=video.id AND revokedAt IS NULL
        AND (endsAt IS NULL OR endsAt > now)
  if !ent -> 402 PAYMENT_REQUIRED      // must buy a tier for this video
  else allow
hasFamilyChannel(user):
  ent = Entitlement where userId=user.id AND kind=FAMILY_CHANNEL
        AND revokedAt IS NULL AND (endsAt IS NULL OR endsAt > now)
  return !!ent
```

GATING MODEL — DECISION: build free, pay-per-video to publish/download.
- Building a draft + running generation is FREE (matches the self-serve funnel; the
  memorial is emotional, the trial sells it). Generation-cost risk is bounded by a
  soft concurrent-draft cap + existing rate limits; if fal spend becomes a problem,
  add a preview-watermark / low-res-until-paid rule in the Job layer (deferred —
  the seam is there).
- Publishing + downloading the final video require a paid one-time tier attached to
  that video (the PUBLISH_VIDEO entitlement). The chosen tier governs limits (max
  images, max duration) read from Plan.metadata. This maps directly to the pricing
  page: tiers are one-time per-tribute buys; the Family Channel is a separate
  optional subscription. Justification: matches what the business sells, keeps the
  funnel friction-free until the moment of value, makes entitlement checks one
  indexed query.

/download for a PUBLISHED video is also publicly allowed by slug (the share page
offers download); the un-published owner download path requires the entitlement.

### 5.7 Refunds, failed payments, lapsed subscriptions
- Refunds (admin): POST /admin/billing/refund {orderId, amountCents?, reason,
  unpublish?} -> stripe.refunds.create -> write Refund + flip Order.status +
  Payment(REFUNDED) + revoke the PUBLISH_VIDEO entitlement. The charge.refunded
  webhook is the source of truth and may also fire; both paths idempotent (keyed on
  stripeRefundId).
- Failed subscription payment (dunning): invoice.payment_failed -> PAST_DUE; Stripe
  Smart Retries / dunning emails run automatically (configure in dashboard); we send
  our own past-due email. The FAMILY_CHANNEL entitlement stays valid through grace
  (endsAt = last good currentPeriodEnd); only on subscription.deleted / unpaid does
  it lapse.
- Lapsed Family Channel vs "hosted forever" — RECONCILED. Pricing promises the
  memorial page is hosted forever REGARDLESS of the Family Channel ("Tributes
  ordered without it still get a permanent memorial page"). So a lapsed/canceled
  Family Channel NEVER unpublishes or hides a tribute — it only removes
  Family-Channel features (multi-pet archive, anniversary reminders, family
  uploads). Concretely public/videos/:slug + finalVideoUrl serve forever; only
  routes gated by hasFamilyChannel(user) go dark. The PUBLISH_VIDEO entitlement
  (one-time tier) keeps a tribute published and has endsAt=null (perpetual) — never
  tied to the subscription.
- (c) Refunded tier: refunding a tier revokes its PUBLISH_VIDEO entitlement -> next
  assertCanPublish fails. RECOMMENDATION: a refund triggers Video.takenDownAt /
  unpublish by default — but make it an explicit toggle on the admin refund action
  ({unpublish:true} default true), because some refunds are goodwill where the
  family keeps the page. Audit either way.

### 5.8 Test vs live keys & MRR analytics
- Keys: STRIPE_SECRET_KEY is sk_test_... on staging/dev, sk_live_... in prod.
  STRIPE_WEBHOOK_SECRET differs per environment. Plan.stripePriceId differs between
  test and live mode — seed from env per deploy. Never mix modes in one DB (staging
  uses a separate DB anyway).
- Analytics derive entirely from Payment / Subscription / Order:
  - Revenue gross = SUM(Payment.amountCents WHERE SUCCEEDED) over a window; net =
    minus SUM(Refund.amountCents).
  - MRR = sum normalized monthly value of Subscription WHERE status IN
    (ACTIVE,TRIALING,PAST_DUE): monthly=price, annual=price/12. Lifetime is not MRR
    (one-time revenue). ARR = MRR x 12.
  - Active subscriptions = count Subscription WHERE status=ACTIVE.
  - Churn (monthly) = canceled in period / active at period start (we have
    canceledAt + currentPeriodEnd).
  - One-time tier revenue & mix = group Order(PAID) by planCode.
  All served by GET /admin/metrics + the ledger endpoints.

---

## 6. COMPLETE API SURFACE

Base https://api.peterna.com. Auth: P=public, U=user, A=admin, O=owner. Status vs
existing builder routes: NEW / REUSE (ported as-is) / CHANGE (ported +
ownership/state-scoping).

### 6.1 Auth /auth/*
| M | Path | Auth | Status | Purpose / shape |
|---|---|---|---|---|
| POST | /auth/register | P | NEW | {email,password,name} -> 201 + session; sends verify |
| POST | /auth/login | P | NEW | {email,password,reactivate?} -> {user} + cookie; 409 DEACTIVATED, 403 SUSPENDED |
| POST | /auth/logout | U | NEW | revoke session |
| POST | /auth/verify | P | NEW | {token} -> PENDING->ACTIVE |
| POST | /auth/resend-verify | U | NEW | throttled |
| POST | /auth/forgot | P | NEW | {email} always 200 |
| POST | /auth/reset | P | NEW | {token,newPassword} -> revoke all sessions |

### 6.2 Current user /me, /videos/*
| M | Path | Auth | Status | Purpose / shape |
|---|---|---|---|---|
| GET | /me | U | NEW | {id,email,name,role,status,emailVerified,hasFamilyChannel} |
| PATCH | /me | U | NEW | update name; {deactivate:true} self-deactivate |
| POST | /me/password | U | NEW | {current,new}; revoke other sessions |
| GET | /me/sessions | U | NEW | active sessions |
| DELETE | /me/sessions/:id | U | NEW | revoke one (or all) |
| POST | /me/reactivate | U(deact) | NEW | DEACTIVATED->ACTIVE |
| GET | /videos | U | CHANGE (was GET /api/build) | my videos, indexed cols only |
| POST | /videos | U | CHANGE (was POST /api/build) | create draft; assertCanCreateVideo -> {id} |
| GET | /videos/:id | O | CHANGE (was GET /api/build/[id]) | {id,state,stepIndex,status,tier} |
| PUT | /videos/:id | O | CHANGE (was PUT /api/build/[id]) | overwrite state blob |
| DELETE | /videos/:id | O | NEW | soft delete |
| POST | /videos/:id/duplicate | O | NEW | clone state into new draft |
| POST | /videos/:id/publish | O | CHANGE (absorbs POST /api/tribute) | assertCanPublish -> set shareSlug+publishedAt |
| POST | /videos/:id/unpublish | O | NEW | clear shareSlug |

### 6.3 Generation (ownership-scoped; today anonymous)
| M | Path | Auth | Status | Maps from |
|---|---|---|---|---|
| POST | /videos/:id/jobs | O | CHANGE | unifies video/beat, video/music, video/narration, video/assemble, image/generate, image/edit, image/grid, card/render via {kind,beatIndex?,payload}; creates Job -> {jobId} |
| GET | /videos/:id/jobs | O | NEW | job statuses for this video |
| GET | /jobs/:jobId | O | CHANGE (was GET /api/video/status) | one job status+result; on poll completes via fal + rehost + writes Video.state |
| POST | /videos/:id/compose | O | CHANGE (was /api/video/compose) | local ffmpeg; serialized; -> Job or {url} |
| POST | /videos/:id/burn-captions | O | CHANGE | per-beat caption burn |
| POST | /videos/:id/photos | O | CHANGE (was /api/photo/upload + /import) | upload/import source photo -> writes state.petPhotos |
| POST | /videos/:id/audio | O | CHANGE (was /api/audio/upload) | upload music -> writes state.musicBedUrl |
| POST | /gemini | U | REUSE | stateless text gen, user-scoped + rate-limited |
| GET | /download | O, or P if published | REUSE | same-origin asset proxy (fal/S3 allowlist unchanged) |
| POST | /webhooks/fal | P signed | NEW | fal completion fast-path -> mark Job done |

DESIGN NOTE (carried): generation handlers now LOAD asset URLs from Video.state
server-side (not trusting the client body) and WRITE results back into Video.state.
Request/response bodies otherwise stay identical to today so the port is mechanical
and QA can diff behavior.

### 6.4 Billing /billing/*
| M | Path | Auth | Status | Purpose / shape |
|---|---|---|---|---|
| GET | /billing/plans | P | NEW | live catalog: tiers + channel plans |
| POST | /videos/:id/checkout | O | NEW | buy a one-time TIER for this video -> {checkoutUrl} |
| POST | /billing/checkout | U | NEW | {planCode} subscription or lifetime -> {checkoutUrl} |
| POST | /billing/portal | U | NEW | Stripe Billing Portal session -> {portalUrl} |
| GET | /billing/subscription | U | NEW | my Family Channel status |
| GET | /billing/history | U | NEW | my orders + invoices + receipts |

### 6.5 Webhooks
| M | Path | Auth | Status | Purpose |
|---|---|---|---|---|
| POST | /webhooks/stripe | P (sig) | NEW | Stripe events (5.5); raw body; idempotent |
| POST | /webhooks/fal | P (sig) | NEW | fal completion fast-path |

### 6.6 Public /public/*
| M | Path | Auth | Status | Purpose |
|---|---|---|---|---|
| GET | /public/videos/:slug | P | CHANGE (was tributes read) | published tribute for the share page; 404 if owner SUSPENDED |

### 6.7 Admin /admin/* (all A; requireAdmin + AuditLog every action)
| M | Path | Purpose / shape |
|---|---|---|
| GET | /admin/metrics | KPIs incl revenue/MRR/active-subs/churn (5.8, 7.1) |
| GET | /admin/users?q=&status=&role=&sort=&page= | paginated users + counts |
| GET | /admin/users/:id | user + videos + activity + sessions + orders + subs |
| POST | /admin/users/:id/activate | ->ACTIVE |
| POST | /admin/users/:id/deactivate | ->DEACTIVATED + revoke sessions |
| POST | /admin/users/:id/suspend | {reason} ->SUSPENDED + revoke sessions |
| POST | /admin/users/:id/unsuspend | ->ACTIVE |
| POST | /admin/users/:id/role | promote/demote |
| POST | /admin/users/:id/force-logout | revoke all sessions |
| GET | /admin/videos?q=&status=&userId=&page= | all videos across tenants |
| GET | /admin/videos/:id | FULL detail: parsed state, jobs, assets, owner, audit |
| POST | /admin/videos/:id/unpublish | takedown (clear slug) |
| POST | /admin/videos/:id/delete | soft delete / takedown |
| GET | /admin/activity?actorId=&action=&from=&to=&page= | global audit log |
| GET | /admin/jobs?status= | job-queue health, failures |
| POST | /admin/jobs/:id/retry | requeue a failed generation |
| GET | /admin/billing/orders?status=&planCode=&page= | one-time order ledger |
| GET | /admin/billing/subscriptions?status=&page= | subscription ledger |
| GET | /admin/billing/invoices?page= | payment/invoice ledger |
| POST | /admin/billing/refund | {orderId,amountCents?,reason,unpublish?} -> Stripe refund + records |

---

## 7. ADMIN DASHBOARD SPEC (complete)

Routes under app.peterna.com/admin; every backing API call independently
requireAdmin (DB session -> role). Same session cookie; separation is by role +
per-endpoint enforcement + full audit logging. No separate admin login.

### 7.1 Overview / Home — GET /admin/metrics
KPI cards + charts:
- Users: total, by status (PENDING/ACTIVE/DEACTIVATED/SUSPENDED), new 7d/30d.
- Videos: total, by status; created-over-time, published-over-time.
- Generation: success/failure rate from Job (7/30d); in-flight COMPOSE.
- Revenue (NOW LIVE): gross + net revenue (window), one-time vs subscription split,
  MRR, ARR, active subscriptions, monthly churn, ARPU. Derivation in 5.8.

### 7.2 Users — GET /admin/users
Table: email, name, role, status, video count, lastLoginAt, createdAt. Search
(email/name), filter (status, role), sort, pagination. Row actions: activate /
deactivate / suspend / unsuspend, view detail.

### 7.3 User detail — GET /admin/users/:id
- Account panel (all fields incl status, statusReason, statusChangedBy/At,
  emailVerified, role, stripeCustomerId, timestamps).
- Their videos (links to admin video detail).
- Billing panel (NOW LIVE): orders (tier + lifetime), subscription(s) with
  status/period-end/cancel flag, entitlements, payment history; refund action per
  order; link to the Stripe customer.
- Activity log (their AuditLog rows).
- Active sessions (ip, userAgent, lastSeenAt) + force-logout.
- Actions: activate/deactivate/suspend/unsuspend, change role, force-logout,
  resend-verify.

### 7.4 Video detail — GET /admin/videos/:id
Owner (link), status, lifecycle timestamps, shareSlug + public link, paid tier +
linked Order. Full parsed state rendered readably (pet profile, beats, every asset
URL: storyboard frames, beat videos, cards, music, narration, composed mp4,
approvals, gate notes). Job history (kind, status, falRequestId, timings, errors) —
the generation forensics view. Audit trail for this video. Admin actions: retry
failed jobs, unpublish/takedown, soft-delete.

### 7.5 Payments ledger (NEW section)
Three tabs, backed by GET /admin/billing/{orders,subscriptions,invoices}:
- Orders: all one-time buys (tier + lifetime) with user, plan, amount, status, video
  link, receipt; issue-refund action (POST /admin/billing/refund).
- Subscriptions: all Family Channel subs with user, plan, status, period-end,
  cancel-at-period-end; link to Stripe.
- Invoices/Payments: the Payment ledger (succeeded/failed/refunded) + Refund
  records — the money trail for reconciliation.

### 7.6 Global activity log — GET /admin/activity
Filterable timeline (actor, action, target, date range) over AuditLog. Now includes
all billing.* events alongside auth/video/job/admin events.

### 7.7 System health — GET /admin/jobs
Job queue counts by status; in-flight COMPOSE single-slot (busy/free); failed jobs
with error + retry button; recent fal failures. Optional: recent WebhookEvent
volume + last Stripe event processed (webhook-health indicator).

### 7.8 Funnel analytics
From Video.stepIndex (maps to the builder STEPS order) + AuditLog: histogram of
furthest step per video -> gate drop-off (character sheet -> storyboard ->
cinematography -> publish -> paid). Extendable with a paid-conversion rate (videos
published / videos that reached READY). No new tracking infra for v1.

---

## 8. AUDIT LOGGING — event taxonomy

action strings, dot-namespaced. actorId null = system/webhook.
- auth.: auth.register, auth.login, auth.login.failed, auth.logout,
  auth.email.verified, auth.password.reset_requested, auth.password.reset,
  auth.verify.resent.
- user. (4.6): user.status.activated, .deactivated, .suspended, .unsuspended,
  .reactivated_self, user.role.changed.
- video.: video.created, video.updated, video.published, video.unpublished,
  video.deleted, video.duplicated, video.taken_down.
- job.: job.enqueued, job.started, job.done, job.failed, job.retried.
- billing.: billing.checkout.created, billing.order.paid, billing.order.failed,
  billing.refund.issued, billing.subscription.created, billing.subscription.renewed,
  billing.subscription.past_due, billing.subscription.canceled,
  billing.entitlement.granted, billing.entitlement.revoked, billing.chargeback.opened.
- admin.: admin.user.force_logout, admin.video.takedown, admin.job.retry,
  admin.refund.issued, admin.role.granted (incl ADMIN_EMAILS bootstrap).
- security.: security.ratelimit.tripped, security.csrf.rejected,
  security.webhook.bad_signature, security.session.reuse_after_revoke.

metadata carries event specifics (from/to status, amounts, planCode, ip, etc.).

---

## 9. BUILD SEQUENCE

Each phase is independently buildable/testable. Phases 0-3 do not touch Stripe.

Phase 0 — Scaffold + schema + dev DB.
Init the peterna-api repo (Next 16, API-only, output:'standalone', webpack,
proxy.ts CORS skeleton). Add the Prisma schema (all models, section 2). Point at
local postgresql-x64-18; prisma db push + generate + seed.ts (Plan rows, dev admin).
Vendor lib/builder-state.ts + the CI drift check (1.3). Health-check route.
Deliverable: empty API boots, schema migrates, plans seeded. Independently
testable: yes (DB + boot).

Phase 1 — Auth + sessions.
lib/server/auth.ts (argon2, session issue/validate, requireUser/Admin/Owner),
tokens.ts, ratelimit.ts, email.ts. All /auth/* + /me*. Cross-subdomain cookie +
CSRF + CORS allowlist. ADMIN_EMAILS bootstrap. Audit wiring starts here.
Independently testable: yes — full auth flow via curl/Playwright against staging
subdomains; no generation needed.

Phase 2 — Videos + ownership.
/videos CRUD, publish/unpublish, /public/videos/:slug. Port the legacy tributes
backfill script. Soft delete. State stored opaque. Independently testable: yes —
create/list/publish a video with a stubbed finalVideoUrl.

Phase 3 — Generation port.
lib/server/jobs.ts + the unified /videos/:id/jobs, /jobs/:id, compose,
burn-captions, photos, audio, gemini, download, /webhooks/fal. Port
fal/Suno/storage/prompts/subtitles libs verbatim. Move state read/write
server-side. Independently testable: yes — run the full 26-step generation on
staging with real fal keys; QA diffs against existing builder behavior. Riskiest
port; keep request/response bodies identical to existing routes to make the diff
mechanical.

Phase 4 — Payments.
stripe.ts, entitlements.ts, /billing/*, /videos/:id/checkout, /webhooks/stripe,
refunds. Wire assertCanPublish/assertCanCreateVideo. Build against Stripe TEST mode
end-to-end (Stripe CLI stripe listen forwards webhooks to local/staging).
Independently testable: yes — full purchase / subscribe / renew (clock-advance) /
cancel / refund flows in test mode before any live key touches prod. Depends on
Phase 1 (user) + Phase 2 (video); NOT Phase 3.

Phase 5 — Admin.
/admin/* incl billing ledger + refund action + metrics (revenue/MRR now real
because Phase 4 populates the tables). Audit history already accrued since Phase 1.
Independently testable: yes — seed data, hit each admin endpoint.

Parallelization: Phase 4 (payments) and Phase 3 (generation) can be built
concurrently by different engineers — they share only the Video model and don't
collide. Phase 5 read-only endpoints can start once Phases 1-2 land.

Delegation: backend builds Phases 0-5 route handlers + libs; devops provisions the
DB/box, Stripe webhook endpoints, SES domain; frontend consumes section 6 for the
dashboard/admin UI + the Stripe redirect flows; QA tests each phase boundary (auth,
ownership, the full generation flow, the test-mode payment flows).

---

## 10. ENV / SECRETS & SECURITY

### 10.1 Env (.env.example)
```
# Core
DATABASE_URL=postgresql://USER:PASS@HOST:5432/peterna_api
SESSION_COOKIE_DOMAIN=.peterna.com
SESSION_SECRET=<random 32+ bytes>            # token-hash pepper / CSRF signing
ADMIN_EMAILS=shan@officiallabs.com,...
CORS_ALLOWED_ORIGINS=https://app.peterna.com,https://staging.peterna.com
APP_BASE_URL=https://app.peterna.com         # verify/reset/checkout return links

# Stripe
STRIPE_SECRET_KEY=sk_test_... | sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_test_... | pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...              # per-environment endpoint secret

# Email
EMAIL_PROVIDER=ses                           # ses | resend
SES_REGION=us-east-1
EMAIL_FROM="Peterna <no-reply@peterna.com>"
# RESEND_API_KEY=...                          # if EMAIL_PROVIDER=resend

# Generation (PORTED from builder)
FAL_KEY=...
SUNO_API_KEY=...
SUNO_MODEL=V4_5
GEMINI_API_KEY=...
FAL_WEBHOOK_SECRET=...                        # verify /webhooks/fal

# Storage (PORTED from builder)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET=peterna-api-assets
S3_KEY_PREFIX=peterna/
```

### 10.2 Security considerations
- Webhook signature verification on BOTH /webhooks/stripe (constructEvent with
  STRIPE_WEBHOOK_SECRET, raw body) and /webhooks/fal (FAL_WEBHOOK_SECRET). Reject
  unsigned/invalid -> 400 + security.webhook.bad_signature audit. CSRF/CORS-exempt.
- PCI scope minimized by Stripe-hosted Checkout + Billing Portal (SAQ A; no card
  data ever touches our servers).
- Idempotency on Stripe webhooks via WebhookEvent PK dedupe; all handlers
  idempotent (Stripe retries).
- Rate limiting on auth endpoints (per-IP + per-email) and /gemini / job enqueue
  (per-user) to bound fal/Gemini spend and brute force.
- CORS allowlist (exact origins, never * with credentials); Allow-Credentials: true;
  OPTIONS handled in proxy.ts.
- Secret handling: all secrets live ONLY on the API box; the frontend holds none.
  STRIPE_PUBLISHABLE_KEY is the sole client-safe value (and only needed if the
  frontend ever uses Stripe.js — with hosted Checkout it largely is not).
- SSRF guard retained in storage.ts (rehost only fetches *.fal.media).
- CSRF double-submit token on all mutating non-webhook requests.
- Authz in handlers, not proxy (Next 16): every protected route calls
  requireUser/Owner/Admin against the DB session; proxy.ts is CORS only.
- Owner checks on every /videos/:id/* and /jobs/:id route — never trust a
  client-supplied id without verifying Video.userId == session.userId (or admin).

---

## 11. OPEN QUESTIONS (need user / CTO input)

1. Gating model confirm: build-free, pay-per-video-to-publish (5.6) — confirm this
   matches the intended commercial model (vs a paywall before building). I recommend
   build-free; the funnel and pricing copy support it.
2. Refund -> unpublish default: should refunding a tier take the public tribute down
   by default? I lean yes-but-overridable (5.7c).
3. Elite "first year Family Channel included": confirm modeling as a 1-year
   FAMILY_CHANNEL entitlement grant (not a real Stripe sub), with a prompt-to-
   subscribe (no auto-charge) at year-end.
4. Email provider: SES (AWS creds already present) vs Resend — needs a sending domain
   + DKIM. Devops/user call.
5. Box placement: own EC2 for peterna-api (needs ffmpeg + all secrets), or a new pm2
   process on an existing box? Devops call. Staging 52.7.25.179 exists.
6. Legacy Build drafts: confirm we do NOT migrate anonymous drafts (recommend not —
   low value), only the tributes public pages.
7. Currency / tax: USD-only assumed. If international, enable Stripe Tax (adds a
   Plan/tax config column). Out of scope unless confirmed.
