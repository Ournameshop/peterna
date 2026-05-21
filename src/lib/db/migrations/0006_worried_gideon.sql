ALTER TABLE "sessions" ADD COLUMN "eulogy_pdf_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "eulogy_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "delivery_share_slug" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "delivery_emailed_to" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "delivery_ready_at" timestamp with time zone;