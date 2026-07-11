CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"key_ideas" jsonb NOT NULL,
	"quotes" jsonb NOT NULL,
	"audience" jsonb,
	"opportunities" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"source_id" uuid,
	"title" text NOT NULL,
	"angle" text,
	"bucket" text DEFAULT 'suggested' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"post_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "idea_id" uuid;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "post_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "dna_match" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "scheduled_at" timestamp with time zone;