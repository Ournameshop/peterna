ALTER TABLE "sessions" ADD COLUMN "video_clip_asset_ids" text[];--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "video_clip_statuses" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "assembled_video_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "video_approved_at" timestamp with time zone;