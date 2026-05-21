ALTER TABLE "sessions" ADD COLUMN "cinematography_frame_vision" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "cinematography_briefs" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "cinematography_dp_overlay" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "cinematography_approved_at" timestamp with time zone;