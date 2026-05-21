ALTER TABLE "sessions" ADD COLUMN "beat_sheet" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "beat_sheet_approved_at" timestamp with time zone;