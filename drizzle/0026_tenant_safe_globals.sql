-- Two facts a tenant legitimately needs that live OUTSIDE its own scope, plus
-- the one index that was in the database but not in the schema.
--
-- Under RLS (ADR-011) a tenant sees only its own rows. Two places in the façade
-- broke on that, silently:
--
--   * a coupon's redemption counter lives on a platform-owned row, so the
--     UPDATE matched nothing — a counter that never moves makes
--     max_redemptions unenforceable, i.e. one coupon redeemable forever;
--   * the affiliate count reads the organizations this org referred, which
--     belong to other tenants, so it always read zero.
--
-- Both are fixed here rather than by widening a policy or handing the tenant
-- path the blanket `app.system` escape. A SECURITY DEFINER function grants
-- exactly ONE capability, is visible in the schema, and behaves identically
-- whether or not RLS is being enforced — so there is one code path, not two.

-- The unique handle is what stops one workspace claiming another's public link
-- page URL. It has existed in the database since 0018 but was never in
-- lib/db/schema.ts, so `drizzle-kit push` would have dropped it. IF NOT EXISTS
-- makes applying this a no-op on any database that already has it.
CREATE UNIQUE INDEX IF NOT EXISTS "brands_handle_idx" ON "brands" USING btree ("handle");--> statement-breakpoint

-- Increment a coupon's redemption counter.
--
-- Deliberately NOT a blanket "tenants may update coupons": the increment only
-- happens for a coupon this org has actually redeemed, which the caller proves
-- by having inserted its coupon_redemptions row first. The unique (org, coupon)
-- index means that is true at most once per workspace, so the function cannot
-- be used to burn down somebody else's coupon.
CREATE OR REPLACE FUNCTION public.coupon_increment_redemption(p_coupon uuid, p_org uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE coupons SET redemptions = redemptions + 1
  WHERE id = p_coupon
    AND EXISTS (
      SELECT 1 FROM coupon_redemptions r
      WHERE r.coupon_id = p_coupon AND r.org_id = p_org
    )
  RETURNING redemptions;
$$;--> statement-breakpoint

-- How many workspaces this one referred. Returns a count and nothing else — no
-- row, no name, no billing state — so the referrer learns its own total without
-- being able to see the workspaces behind it.
CREATE OR REPLACE FUNCTION public.count_referrals(p_org uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM organizations WHERE referred_by = p_org;
$$;--> statement-breakpoint

-- EXECUTE is granted, not assumed: a function nobody may call is not a fix.
GRANT EXECUTE ON FUNCTION public.coupon_increment_redemption(uuid, uuid) TO athar_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.count_referrals(uuid) TO athar_app;
