# Data model — Postgres + S3 + library content

**Owner / agent type:** Backend (schema + storage).
**Prerequisites:** read `architecture.md` §2, §3, §5 first.

## Postgres schema

> Postgres is confirmed; specific host (local for dev, hosted for prod) is deferred. Drizzle ORM works against any Postgres 14+; swap connection strings without schema changes.


Three tables, all UUID primary keys, all `created_at`/`updated_at` timestamps `timestamptz default now()`. Drizzle ORM in `src/lib/db/schema.ts`.

```sql
sessions (
  id                            uuid pk,
  cookie_token                  text unique not null,    -- HMAC-signed, set in httponly cookie
  resume_token                  text unique not null,    -- shareable: /builder/r/<token>
  stage                         text not null default 'intake_welcome',  -- matches builder state machine tag
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),

  -- Stage 1 fields
  returning_user                bool,
  pet_name                      text,
  pet_name_pronunciation        text,
  pet_gender                    text,                    -- 'male' | 'female' | 'neutral'
  relationship                  text,
  memory_prompt_type            text,
  memory_prompt_answer          text,
  personality_traits            text[],                  -- trait IDs
  favorite_things               text[],                  -- favorite IDs
  creator_name                  text,
  years_label                   text,                    -- free-text e.g. "2015 – 2025"

  inferred_profile              jsonb,                   -- vision-pass output (species, breed_guess, coat_description, age_range, body_type, observed_setting?, observed_moment?)
  inferred_confidence           jsonb,                   -- {<field>: 'high'|'medium'|'low'}

  -- Stage 2.5 / 2.6
  beat_count                    int,                     -- 8 | 12 | 16
  target_minutes                int,                     -- 2 | 3 | 4
  aspect_ratio                  text,                    -- '9:16' | '16:9' | '1:1' | 'all_three'

  -- Stage 3
  curators_pick_id              text,
  format_id                     text,
  theme_id                      text,
  style_id                      text,

  -- Locks (foreign keys to assets)
  character_sheet_asset_id      uuid references assets(id),
  combination_preview_asset_id  uuid references assets(id)
);
create index sessions_resume_token_idx on sessions(resume_token);
create index sessions_updated_at_idx on sessions(updated_at);   -- for 30-day purge

assets (
  id              uuid pk,
  session_id      uuid not null references sessions(id) on delete cascade,
  kind            text not null,           -- 'pet_photo' | 'character_sheet' | 'combination_preview' | 'storyboard_frame' | 'card_preview'
  source          text not null,           -- 'upload' | 'url_ingest' | 'vendor_render'
  r2_key          text not null,           -- S3 object key. Column name is historical (Cloudflare R2 era).
  public_url      text not null,
  mime_type       text,
  bytes           int,
  width           int,
  height          int,
  vendor_job_id   text,                    -- vendor's request ID for traceback
  metadata        jsonb,                   -- vendor-specific (model snapshot, seed, etc.)
  created_at      timestamptz not null default now()
);
create index assets_session_id_idx on assets(session_id);

renders (
  id                  uuid pk,
  session_id          uuid not null references sessions(id) on delete cascade,
  stage               text not null,        -- 'vision_pass' | 'character_sheet' | 'combination_preview' | 'storyboard_frame_N' | ...
  capability          text not null,        -- 'generate_image' | 'run_vision_pass' | 'generate_video'
  vendor_attempted    text[] not null,      -- ['openai','fal']
  vendor_served       text,                 -- null if both failed
  model               text,                 -- e.g. 'gpt-image-2-2026-04-21'
  request_body        jsonb,
  response_url        text,                 -- S3-rehosted output (image/video)
  cost_usd_est        numeric(10, 4),
  duration_ms         int,
  error               text,                 -- null on success
  idempotency_key     text not null,
  created_at          timestamptz not null default now(),
  unique (session_id, stage, idempotency_key)
);
create index renders_session_id_idx on renders(session_id);
create index renders_vendor_served_idx on renders(vendor_served, created_at);   -- fallback-rate query
```

## ID strategy

- All primary keys are UUID v7 (time-ordered; index-friendly). Generate in app code (`uuidv7()` from `uuid` package), not via `gen_random_uuid()` server-side — keeps PKs portable if we leave Postgres later.
- `cookie_token` and `resume_token` are 32-byte hex strings (`crypto.randomBytes(32).toString('hex')`); HMAC-signed via `SESSION_SECRET`.

## Lifecycle / retention

- **30-day inactivity purge.** Daily cron (host-cron, node-cron, or a deploy-target-specific scheduler — decided when the deploy target is) at `/api/cron/purge` deletes `sessions` where `updated_at < now() - interval '30 days'`. Cascade removes `assets` and `renders` rows. A second pass calls S3 `DeleteObjects` for any `r2_key` rows that were already removed.
- **S3 lifecycle rule.** Belt-and-suspenders: `sessions/*` keys with no access in 30 days are auto-purged at the bucket layer too (S3 lifecycle policy).
- **User-triggered delete.** `DELETE /api/session/[id]` bypasses the wait — cascades DB rows and `DeleteObjects` immediately.

## S3 layout

Bucket `peterna-tribute-assets`. Keys:

```
sessions/<session_id>/photos/<asset_uuid>.<ext>          -- user uploads / url-ingested
sessions/<session_id>/renders/<asset_uuid>.<ext>         -- vendor output (image)
sessions/<session_id>/clips/<asset_uuid>.mp4             -- Phase 4+ video
```

Public read via CloudFront distribution at `assets.peterna.com`. No signed URLs in Phase 1 — assets are public but the keys are unguessable UUIDs.

> **Note on column naming:** the DB column is `assets.r2_key` (Drizzle binding `r2Key`) — historical from the Cloudflare R2 era. We deliberately did not rename it to `s3_key`: that would require a migration and a wire-type change for zero functional benefit. The application reads/writes S3 object keys through that column. See `src/lib/db/schema.ts` and the matching `r2_key` field on `AssetWire` in `src/lib/builder/wire-types.ts`.

## Library data

Server-only TS modules under `src/lib/library/`. Shape and full file list owned by `copy-and-content.md`. Backend should treat library imports as **immutable, in-memory, server-only**. No library content is persisted in Postgres — it ships with the build. Validation runs at module load (throws if `formats`/`themes`/`art_styles`/`pronouns_and_vocatives` below minimums).
