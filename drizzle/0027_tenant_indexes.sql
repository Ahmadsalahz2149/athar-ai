CREATE INDEX IF NOT EXISTS "analyses_brand_idx" ON "analyses" USING btree ("org_id","brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dna_versions_brand_idx" ON "dna_versions" USING btree ("org_id","brand_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drafts_brand_idx" ON "drafts" USING btree ("org_id","brand_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ideas_brand_idx" ON "ideas" USING btree ("org_id","brand_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sources_brand_idx" ON "sources" USING btree ("org_id","brand_id","created_at");