CREATE TABLE "link_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "link_page" jsonb;--> statement-breakpoint
CREATE INDEX "link_events_brand_idx" ON "link_events" USING btree ("org_id","brand_id","created_at");CREATE UNIQUE INDEX IF NOT EXISTS "brands_handle_idx" ON "brands" ("handle");
