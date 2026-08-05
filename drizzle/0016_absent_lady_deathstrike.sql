CREATE TABLE "content_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"month" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dismissed_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "content_plans_brand_month_idx" ON "content_plans" USING btree ("org_id","brand_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "dismissed_suggestions_key_idx" ON "dismissed_suggestions" USING btree ("org_id","brand_id","key");