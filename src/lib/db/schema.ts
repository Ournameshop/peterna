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
  },
  (table) => [
    index('sessions_resume_token_idx').on(table.resumeToken),
    index('sessions_updated_at_idx').on(table.updatedAt),
  ],
);

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
