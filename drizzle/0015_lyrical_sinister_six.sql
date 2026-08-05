CREATE TABLE "target_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"platform" text DEFAULT 'facebook' NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"member_count" integer,
	"rules" text,
	"status" text DEFAULT 'prospect' NOT NULL,
	"cadence_days" integer DEFAULT 3 NOT NULL,
	"notes" text,
	"last_posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "distribution" jsonb;--> statement-breakpoint
CREATE INDEX "target_groups_brand_idx" ON "target_groups" USING btree ("org_id","brand_id");