-- Back-fill fix: a grantOnce race let some orgs accumulate multiple signup_grant
-- rows (e.g. 3×200 = 600). Keep the earliest signup_grant per org, drop the rest,
-- so the partial-unique index below can be created and future double-grants fail.
DELETE FROM "credit_ledger" a
  USING "credit_ledger" b
  WHERE a."reason" = 'signup_grant'
    AND b."reason" = 'signup_grant'
    AND a."org_id" = b."org_id"
    AND a."created_at" > b."created_at";
--> statement-breakpoint
DELETE FROM "credit_ledger" a
  USING "credit_ledger" b
  WHERE a."reason" = 'signup_grant'
    AND b."reason" = 'signup_grant'
    AND a."org_id" = b."org_id"
    AND a."created_at" = b."created_at"
    AND a."id" > b."id";
--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_signup_grant_uq" ON "credit_ledger" USING btree ("org_id") WHERE "credit_ledger"."reason" = 'signup_grant';
