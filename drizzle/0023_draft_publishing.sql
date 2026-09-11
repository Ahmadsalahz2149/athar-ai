ALTER TABLE "drafts" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "external_post_id" text;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "external_url" text;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "publish_error" text;--> statement-breakpoint
CREATE INDEX "drafts_due_idx" ON "drafts" USING btree ("status","scheduled_at");