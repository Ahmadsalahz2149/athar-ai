CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'product' NOT NULL,
	"description" text,
	"price" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "profile" jsonb;--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("org_id","brand_id");