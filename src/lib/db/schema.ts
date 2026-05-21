import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Phase 10 — user accounts via passwordless magic link. Anonymous sessions
// continue to work; `sessions.user_id` is nullable. Signed-in sessions get
// linked at builder entry or via dashboard claim.
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  },
);

export const magicLinkTokens = pgTable(
  'magic_link_tokens',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull().unique(),  // SHA-256(raw token)
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('magic_link_tokens_email_idx').on(table.email),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    cookieToken: text('cookie_token').notNull().unique(),
    resumeToken: text('resume_token').notNull().unique(),
    stage: text('stage').notNull().default('intake_welcome'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    returningUser: boolean('returning_user'),
    petName: text('pet_name'),
    petNamePronunciation: text('pet_name_pronunciation'),
    petGender: text('pet_gender'),
    relationship: text('relationship'),
    memoryPromptType: text('memory_prompt_type'),
    memoryPromptAnswer: text('memory_prompt_answer'),
    personalityTraits: text('personality_traits').array(),
    favoriteThings: text('favorite_things').array(),
    creatorName: text('creator_name'),
    yearsLabel: text('years_label'),

    inferredProfile: jsonb('inferred_profile'),
    inferredConfidence: jsonb('inferred_confidence'),

    beatCount: integer('beat_count'),
    targetMinutes: integer('target_minutes'),
    aspectRatio: text('aspect_ratio'),

    curatorsPickId: text('curators_pick_id'),
    formatId: text('format_id'),
    themeId: text('theme_id'),
    styleId: text('style_id'),

    // Self-referencing FKs to assets resolved at table-creation time via raw SQL in the migration.
    characterSheetAssetId: uuid('character_sheet_asset_id'),
    combinationPreviewAssetId: uuid('combination_preview_asset_id'),

    // Stage 4 — beat sheet (array of BeatWire). Null until /api/beat-sheet/generate runs.
    beatSheet: jsonb('beat_sheet'),
    beatSheetApprovedAt: timestamp('beat_sheet_approved_at', { withTimezone: true }),

    // Stage 5 — storyboard. Length-N array of asset_ids (one per beat). Each entry
    // points at an `assets` row with `kind='storyboard_frame'` and metadata.beat_idx.
    // Replaced wholesale when a beat is rerolled (entry at beat_idx swaps).
    storyboardFrameAssetIds: text('storyboard_frame_asset_ids').array(),
    storyboardApprovedAt: timestamp('storyboard_approved_at', { withTimezone: true }),

    // Stage 5.5 — "The Words." Title card + closing card text, optional music
    // and narration. Captions per-beat live on `beat_sheet[].caption` (Phase 4a).
    openingTitleCardText: text('opening_title_card_text'),
    closingCardText: text('closing_card_text'),
    musicTrackId: text('music_track_id'),
    narrationVoiceId: text('narration_voice_id'),
    narrationText: text('narration_text'),

    // Stage 5.6 (v2.3) — Card preview. Renders 3 stills before any video fires:
    // opening title card, closing card, one representative in-scene caption frame.
    // Array length 3, indexed: 0=opening, 1=closing, 2=in_scene_caption.
    cardPreviewAssetIds: text('card_preview_asset_ids').array(),
    cardPreviewApprovedAt: timestamp('card_preview_approved_at', { withTimezone: true }),

    // Stage 5.7 — Cinematography Engine (v2.0). Derived motion briefs per beat
    // (array of MotionBriefWire) + per-frame vision pass results + optional DP
    // style overlay. Locks before any video render fires.
    cinematographyFrameVision: jsonb('cinematography_frame_vision'),  // array of FrameVisionWire
    cinematographyBriefs: jsonb('cinematography_briefs'),             // array of MotionBriefWire
    cinematographyDpOverlay: text('cinematography_dp_overlay'),        // dp_style id or null
    cinematographyApprovedAt: timestamp('cinematography_approved_at', { withTimezone: true }),

    // Stage 6 — Video clip generation (Seedance via fal.ai). Length-N array
    // of asset_ids, one per beat. Each entry is an `assets` row kind='video_clip'
    // with metadata.beat_idx. Statuses array parallels the asset IDs.
    videoClipAssetIds: text('video_clip_asset_ids').array(),
    videoClipStatuses: jsonb('video_clip_statuses'),  // array of 'queued'|'rendering'|'done'|'failed' per beat

    // Stage 7 — Final assembled video (stitched clips + title cards + music +
    // narration). One asset_id pointing at the ffmpeg-produced MP4.
    assembledVideoAssetId: uuid('assembled_video_asset_id'),
    videoApprovedAt: timestamp('video_approved_at', { withTimezone: true }),

    // Phase 10 — optional FK to users table. Anonymous sessions remain (null).
    // When a user signs in, their existing anonymous session (and any prior
    // anonymous sessions on the same browser) can be claimed and linked.
    userId: uuid('user_id'),

    // Stage 8 — Eulogy PDF.
    eulogyPdfAssetId: uuid('eulogy_pdf_asset_id'),
    eulogyApprovedAt: timestamp('eulogy_approved_at', { withTimezone: true }),

    // Phase 9 (beyond spec) — Final Delivery snapshot. The shareable URL slug
    // and optional email-out flag. The delivery page reads all locked artifact
    // ids off the session row; no new asset table needed.
    deliveryShareSlug: text('delivery_share_slug'),
    deliveryEmailedTo: text('delivery_emailed_to'),
    deliveryReadyAt: timestamp('delivery_ready_at', { withTimezone: true }),
  },
  (table) => [
    index('sessions_resume_token_idx').on(table.resumeToken),
    index('sessions_updated_at_idx').on(table.updatedAt),
    index('sessions_user_id_idx').on(table.userId),  // dashboard "my tributes" query
  ],
);

export type User = typeof users.$inferSelect;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;

// Phase 12 — background job queue using Postgres-as-queue (no Redis/BullMQ
// dep). Workers SELECT FOR UPDATE SKIP LOCKED to claim jobs atomically.
export const renderJobs = pgTable(
  'render_jobs',
  {
    id: uuid('id').primaryKey(),
    sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),  // 'video_clip' | 'video_batch' | 'assembly'
    payload: jsonb('payload').notNull(),  // { beat_idx?, ... }
    status: text('status').notNull().default('queued'),  // queued | running | done | failed
    attempts: integer('attempts').notNull().default(0),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: text('locked_by'),  // worker id (process.env.HOSTNAME + pid)
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    error: text('error'),
    result: jsonb('result'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('render_jobs_session_id_idx').on(table.sessionId),
    index('render_jobs_status_idx').on(table.status, table.createdAt),
  ],
);

// Phase 12 — Web Push subscriptions per browser/device per user.
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true }),
  },
);

export type RenderJob = typeof renderJobs.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    source: text('source').notNull(),
    /** Historical name (from the Cloudflare R2 era); values are AWS S3 object keys. */
    r2Key: text('r2_key').notNull(),
    publicUrl: text('public_url').notNull(),
    mimeType: text('mime_type'),
    bytes: integer('bytes'),
    width: integer('width'),
    height: integer('height'),
    vendorJobId: text('vendor_job_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('assets_session_id_idx').on(table.sessionId)],
);

export const renders = pgTable(
  'renders',
  {
    id: uuid('id').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    stage: text('stage').notNull(),
    capability: text('capability').notNull(),
    vendorAttempted: text('vendor_attempted').array().notNull(),
    vendorServed: text('vendor_served'),
    model: text('model'),
    requestBody: jsonb('request_body'),
    responseUrl: text('response_url'),
    costUsdEst: numeric('cost_usd_est', { precision: 10, scale: 4 }),
    durationMs: integer('duration_ms'),
    error: text('error'),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('renders_session_id_idx').on(table.sessionId),
    index('renders_vendor_served_idx').on(table.vendorServed, table.createdAt),
    unique('renders_session_stage_idempotency_unique').on(
      table.sessionId,
      table.stage,
      table.idempotencyKey,
    ),
  ],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Render = typeof renders.$inferSelect;
export type NewRender = typeof renders.$inferInsert;

// Re-export `sql` so consumers that need raw SQL helpers can reach for it via the schema barrel.
export { sql };
