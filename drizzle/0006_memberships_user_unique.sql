-- Fix: the bootstrap race let one user own several orgs (concurrent first
-- requests each created org+membership). Keep the EARLIEST membership per user,
-- drop the rest, then remove any org left with no members, then enforce the
-- one-workspace-per-user invariant with a unique index.
DELETE FROM "memberships" a
  USING "memberships" b
  WHERE a."user_id" = b."user_id"
    AND (a."created_at" > b."created_at"
         OR (a."created_at" = b."created_at" AND a."id" > b."id"));
--> statement-breakpoint
DELETE FROM "credit_ledger" WHERE "org_id" IN (SELECT "id" FROM "organizations" o WHERE NOT EXISTS (SELECT 1 FROM "memberships" m WHERE m."org_id" = o."id"));
--> statement-breakpoint
DELETE FROM "drafts" WHERE "org_id" IN (SELECT "id" FROM "organizations" o WHERE NOT EXISTS (SELECT 1 FROM "memberships" m WHERE m."org_id" = o."id"));
--> statement-breakpoint
DELETE FROM "ideas" WHERE "org_id" IN (SELECT "id" FROM "organizations" o WHERE NOT EXISTS (SELECT 1 FROM "memberships" m WHERE m."org_id" = o."id"));
--> statement-breakpoint
DELETE FROM "analyses" WHERE "org_id" IN (SELECT "id" FROM "organizations" o WHERE NOT EXISTS (SELECT 1 FROM "memberships" m WHERE m."org_id" = o."id"));
--> statement-breakpoint
DELETE FROM "source_chunks" WHERE "org_id" IN (SELECT "id" FROM "organizations" o WHERE NOT EXISTS (SELECT 1 FROM "memberships" m WHERE m."org_id" = o."id"));
--> statement-breakpoint
DELETE FROM "sources" WHERE "org_id" IN (SELECT "id" FROM "organizations" o WHERE NOT EXISTS (SELECT 1 FROM "memberships" m WHERE m."org_id" = o."id"));
--> statement-breakpoint
UPDATE "brands" SET "current_dna_version_id" = NULL WHERE "org_id" IN (SELECT "id" FROM "organizations" o WHERE NOT EXISTS (SELECT 1 FROM "memberships" m WHERE m."org_id" = o."id"));
--> statement-breakpoint
DELETE FROM "dna_versions" WHERE "org_id" IN (SELECT "id" FROM "organizations" o WHERE NOT EXISTS (SELECT 1 FROM "memberships" m WHERE m."org_id" = o."id"));
--> statement-breakpoint
DELETE FROM "brands" WHERE "org_id" IN (SELECT "id" FROM "organizations" o WHERE NOT EXISTS (SELECT 1 FROM "memberships" m WHERE m."org_id" = o."id"));
--> statement-breakpoint
DELETE FROM "organizations" o WHERE NOT EXISTS (SELECT 1 FROM "memberships" m WHERE m."org_id" = o."id");
--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_uq" ON "memberships" USING btree ("user_id");
