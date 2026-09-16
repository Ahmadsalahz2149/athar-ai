CREATE TABLE "review_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"label" text,
	"token_hash" text NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_links" ADD CONSTRAINT "review_links_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_links" ADD CONSTRAINT "review_links_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_links_token_uq" ON "review_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "review_links_brand_idx" ON "review_links" USING btree ("org_id","brand_id","created_at");--> statement-breakpoint
-- Same rule as every other tenant table (ADR-011). The public review surface
-- has no org context — the token IS the key — so it declares itself system for
-- the lookup, exactly as the public link page does.
ALTER TABLE "review_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "review_links_tenant" ON "review_links";--> statement-breakpoint
CREATE POLICY "review_links_tenant" ON "review_links" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');
