CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "memberships_user_uq";--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_uq" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitations_org_idx" ON "invitations" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_org_uq" ON "memberships" USING btree ("user_id","org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_owner_uq" ON "memberships" USING btree ("user_id") WHERE role = 'owner';--> statement-breakpoint
CREATE INDEX "memberships_org_idx" ON "memberships" USING btree ("org_id");--> statement-breakpoint
-- A new table is invisible to RLS until it is told to take part, and a table
-- added after 0025 with no policy is a tenant table with no second line of
-- defence. Same rule as everywhere else: the row belongs to app.org_id, or the
-- caller declared itself system. Accepting an invitation is necessarily
-- system-scoped — the token IS the key and the accepting user is not a member
-- of that workspace yet.
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "invitations_tenant" ON "invitations";--> statement-breakpoint
CREATE POLICY "invitations_tenant" ON "invitations" FOR ALL
  USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on')
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid
         OR current_setting('app.system', true) = 'on');
