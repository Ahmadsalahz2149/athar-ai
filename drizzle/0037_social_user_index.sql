CREATE INDEX "social_connections_user_idx" ON "social_connections" USING btree ("external_user_id");--> statement-breakpoint
-- data_deletion_requests is deliberately NOT org-scoped: a deletion request
-- identifies a person on a platform, who may have connections in several
-- workspaces or none. So the usual tenant policy does not apply, and the right
-- rule is narrower — only a caller that has declared itself system may touch it
-- at all. That is exactly how the callback reaches it.
ALTER TABLE "data_deletion_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "data_deletion_system_only" ON "data_deletion_requests";--> statement-breakpoint
CREATE POLICY "data_deletion_system_only" ON "data_deletion_requests" FOR ALL
  USING (current_setting('app.system', true) = 'on')
  WITH CHECK (current_setting('app.system', true) = 'on');
