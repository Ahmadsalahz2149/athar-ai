-- Row-level security (ADR-011): a second line of tenant isolation INSIDE the
-- database, behind the forOrg() façade.
--
-- Enabled, not FORCED. Postgres exempts a table's OWNER from its own row
-- policies unless FORCE is set, and the application currently connects as the
-- owner — so applying this migration changes NOTHING about how the app behaves
-- today. The policies become live the moment the app connects as the
-- unprivileged role created below, which is a one-line change to DATABASE_URL
-- and is reversible the same way. That is deliberate: an isolation mechanism
-- that can take the product down the instant it is applied is not one you can
-- safely roll out to a running system.
--
-- The rule: a row is visible when it belongs to the org in `app.org_id`, which
-- forOrg() sets per transaction. With the setting absent the comparison is NULL
-- and NOTHING matches — deny by default. A query that forgets to scope itself
-- therefore returns nothing instead of another tenant's data.
--
-- `app.system` is the explicit escape for the handful of genuinely cross-org
-- components (the job queue, the publish dispatcher, the Stripe webhook's
-- customer lookup, GDPR erasure/export, the platform admin area, workspace
-- bootstrap and the public link page). They opt in per transaction and are the
-- documented allowlist of lib/db/rls.ts — the same set the ADR-005 lint rule
-- already exempts from the façade.

-- The role the application will connect as. NOLOGIN and passwordless on
-- purpose: a credential must never live in a migration. The operator gives it a
-- password and switches DATABASE_URL when they choose to turn enforcement on
-- (see docs/RLS.md).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'athar_app') THEN
    CREATE ROLE athar_app NOLOGIN;
  END IF;
END
$$;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO athar_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO athar_app;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO athar_app;--> statement-breakpoint
-- Tables added by later migrations must be reachable too, or the next feature
-- silently breaks only for the restricted role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO athar_app;--> statement-breakpoint
ALTER TABLE "analyses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "analyses_tenant" ON "analyses";--> statement-breakpoint
CREATE POLICY "analyses_tenant" ON "analyses" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "assistant_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "assistant_messages_tenant" ON "assistant_messages";--> statement-breakpoint
CREATE POLICY "assistant_messages_tenant" ON "assistant_messages" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "brands_tenant" ON "brands";--> statement-breakpoint
CREATE POLICY "brands_tenant" ON "brands" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "content_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "content_plans_tenant" ON "content_plans";--> statement-breakpoint
CREATE POLICY "content_plans_tenant" ON "content_plans" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "coupon_redemptions_tenant" ON "coupon_redemptions";--> statement-breakpoint
CREATE POLICY "coupon_redemptions_tenant" ON "coupon_redemptions" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "credit_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "credit_ledger_tenant" ON "credit_ledger";--> statement-breakpoint
CREATE POLICY "credit_ledger_tenant" ON "credit_ledger" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "dismissed_suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "dismissed_suggestions_tenant" ON "dismissed_suggestions";--> statement-breakpoint
CREATE POLICY "dismissed_suggestions_tenant" ON "dismissed_suggestions" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "dna_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "dna_versions_tenant" ON "dna_versions";--> statement-breakpoint
CREATE POLICY "dna_versions_tenant" ON "dna_versions" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "drafts_tenant" ON "drafts";--> statement-breakpoint
CREATE POLICY "drafts_tenant" ON "drafts" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "ideas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "ideas_tenant" ON "ideas";--> statement-breakpoint
CREATE POLICY "ideas_tenant" ON "ideas" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "invoices_tenant" ON "invoices";--> statement-breakpoint
CREATE POLICY "invoices_tenant" ON "invoices" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "jobs_tenant" ON "jobs";--> statement-breakpoint
CREATE POLICY "jobs_tenant" ON "jobs" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "lesson_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "lesson_progress_tenant" ON "lesson_progress";--> statement-breakpoint
CREATE POLICY "lesson_progress_tenant" ON "lesson_progress" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "link_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "link_events_tenant" ON "link_events";--> statement-breakpoint
CREATE POLICY "link_events_tenant" ON "link_events" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "media_assets_tenant" ON "media_assets";--> statement-breakpoint
CREATE POLICY "media_assets_tenant" ON "media_assets" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "memberships_tenant" ON "memberships";--> statement-breakpoint
CREATE POLICY "memberships_tenant" ON "memberships" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "products_tenant" ON "products";--> statement-breakpoint
CREATE POLICY "products_tenant" ON "products" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "social_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "social_connections_tenant" ON "social_connections";--> statement-breakpoint
CREATE POLICY "social_connections_tenant" ON "social_connections" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "source_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "source_chunks_tenant" ON "source_chunks";--> statement-breakpoint
CREATE POLICY "source_chunks_tenant" ON "source_chunks" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "sources_tenant" ON "sources";--> statement-breakpoint
CREATE POLICY "sources_tenant" ON "sources" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "target_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "target_groups_tenant" ON "target_groups";--> statement-breakpoint
CREATE POLICY "target_groups_tenant" ON "target_groups" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "organizations_tenant" ON "organizations";--> statement-breakpoint
-- The org row itself is identified by its own id.
CREATE POLICY "organizations_tenant" ON "organizations" FOR ALL
  USING (id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "platform_admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "platform_admins_system" ON "platform_admins";--> statement-breakpoint
-- Not tenant data: who administers the platform. Only the admin paths, which
-- run as system, may touch it.
CREATE POLICY "platform_admins_system" ON "platform_admins" FOR ALL
  USING (current_setting('app.system', true) = 'on')
  WITH CHECK (current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "coupons_read" ON "coupons";--> statement-breakpoint
DROP POLICY IF EXISTS "coupons_system" ON "coupons";--> statement-breakpoint
-- A coupon is a platform-wide catalogue entry with no owning tenant: any
-- workspace must be able to look one up to redeem it...
CREATE POLICY "coupons_read" ON "coupons" FOR SELECT USING (true);--> statement-breakpoint
-- ...but only the admin area, running as system, may create or change one.
CREATE POLICY "coupons_system" ON "coupons" FOR ALL
  USING (current_setting('app.system', true) = 'on')
  WITH CHECK (current_setting('app.system', true) = 'on');
