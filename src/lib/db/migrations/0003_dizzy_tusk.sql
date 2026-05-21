ALTER TABLE "sessions" ADD COLUMN "opening_title_card_text" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "closing_card_text" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "music_track_id" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "narration_voice_id" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "narration_text" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "card_preview_asset_ids" text[];--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "card_preview_approved_at" timestamp with time zone;