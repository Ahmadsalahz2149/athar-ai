CREATE TABLE "post_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_post_id" text NOT NULL,
	"impressions" integer,
	"likes" integer,
	"comments" integer,
	"shares" integer,
	"clicks" integer,
	"captured_on" date NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "post_metrics_daily_uq" ON "post_metrics" USING btree ("draft_id","captured_on");--> statement-breakpoint
CREATE INDEX "post_metrics_brand_idx" ON "post_metrics" USING btree ("org_id","brand_id","captured_at");--> statement-breakpoint
-- A new tenant table needs its policy in the SAME migration that creates it.
-- Adding the table now and the policy later leaves a window where the
-- restricted role can read every workspace's numbers (ADR-011).
ALTER TABLE "post_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "post_metrics_tenant" ON "post_metrics";--> statement-breakpoint
CREATE POLICY "post_metrics_tenant" ON "post_metrics" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "post_metrics" TO athar_app;
