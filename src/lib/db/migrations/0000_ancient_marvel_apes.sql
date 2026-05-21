CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"r2_key" text NOT NULL,
	"public_url" text NOT NULL,
	"mime_type" text,
	"bytes" integer,
	"width" integer,
	"height" integer,
	"vendor_job_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"capability" text NOT NULL,
	"vendor_attempted" text[] NOT NULL,
	"vendor_served" text,
	"model" text,
	"request_body" jsonb,
	"response_url" text,
	"cost_usd_est" numeric(10, 4),
	"duration_ms" integer,
	"error" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "renders_session_stage_idempotency_unique" UNIQUE("session_id","stage","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cookie_token" text NOT NULL,
	"resume_token" text NOT NULL,
	"stage" text DEFAULT 'intake_welcome' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"returning_user" boolean,
	"pet_name" text,
	"pet_name_pronunciation" text,
	"pet_gender" text,
	"relationship" text,
	"memory_prompt_type" text,
	"memory_prompt_answer" text,
	"personality_traits" text[],
	"favorite_things" text[],
	"creator_name" text,
	"years_label" text,
	"inferred_profile" jsonb,
	"inferred_confidence" jsonb,
	"beat_count" integer,
	"target_minutes" integer,
	"aspect_ratio" text,
	"curators_pick_id" text,
	"format_id" text,
	"theme_id" text,
	"style_id" text,
	"character_sheet_asset_id" uuid,
	"combination_preview_asset_id" uuid,
	CONSTRAINT "sessions_cookie_token_unique" UNIQUE("cookie_token"),
	CONSTRAINT "sessions_resume_token_unique" UNIQUE("resume_token")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renders" ADD CONSTRAINT "renders_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_session_id_idx" ON "assets" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "renders_session_id_idx" ON "renders" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "renders_vendor_served_idx" ON "renders" USING btree ("vendor_served","created_at");--> statement-breakpoint
CREATE INDEX "sessions_resume_token_idx" ON "sessions" USING btree ("resume_token");--> statement-breakpoint
CREATE INDEX "sessions_updated_at_idx" ON "sessions" USING btree ("updated_at");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_character_sheet_asset_id_assets_id_fk" FOREIGN KEY ("character_sheet_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_combination_preview_asset_id_assets_id_fk" FOREIGN KEY ("combination_preview_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;