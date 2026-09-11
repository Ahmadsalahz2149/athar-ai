import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";
import { asSystem } from "@/lib/db/rls";

/**
 * Row-level security (ADR-011), proved against a real restricted role.
 *
 * The rest of the suite connects as the owner, which Postgres exempts from its
 * own policies — so it can say nothing about whether the policies work. These
 * tests open a SECOND connection as the unprivileged role the app will use in
 * production, and check the thing that actually matters: that a query which
 * forgets to scope itself returns nothing rather than another tenant's rows.
 *
 * Requires migration 0025 plus a local password on the role; skipped otherwise
 * so a fresh checkout does not fail on a missing role.
 */
function ownerUrl(): string | null {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return process.env.DATABASE_URL ?? null;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i > 0 && s.slice(0, i).trim() === "DATABASE_URL") return s.slice(i + 1).trim();
  }
  return process.env.DATABASE_URL ?? null;
}

/** The same database, reached as the unprivileged role. */
function restrictedUrl(owner: string | null): string | null {
  if (process.env.DATABASE_URL_RLS) return process.env.DATABASE_URL_RLS;
  if (!owner) return null;
  try {
    const u = new URL(owner);
    u.username = "athar_app";
    u.password = "localtest";
    return u.toString();
  } catch {
    return null;
  }
}

const OWNER_URL = ownerUrl();
const RLS_URL = restrictedUrl(OWNER_URL);
const opts = { ssl: { rejectUnauthorized: false }, prepare: false, max: 3 } as const;

const ownerSql = OWNER_URL ? postgres(OWNER_URL, opts) : null;
const ownerDb = ownerSql ? drizzle(ownerSql, { schema }) : null;
const rlsSql = RLS_URL ? postgres(RLS_URL, opts) : null;
const rlsDb = rlsSql ? drizzle(rlsSql, { schema }) : null;

let ready = false;
let orgA = "";
let orgB = "";
let brandA = "";
let brandB = "";

describe.runIf(!!ownerDb && !!rlsDb)("row-level security", () => {
  beforeAll(async () => {
    // Can the restricted role connect at all, and are the policies applied?
    try {
      await rlsSql!`select 1`;
      const [{ n }] = await ownerSql!<{ n: number }[]>`
        select count(*)::int as n from pg_policies where schemaname = 'public' and policyname = 'drafts_tenant'`;
      ready = n > 0;
    } catch {
      ready = false;
    }
    if (!ready) return;

    // Setup runs as the OWNER — bypassing RLS is exactly how a migration or an
    // operator works, and it is what lets us plant a second tenant's rows.
    const [a] = await ownerDb!.insert(schema.organizations).values({ name: "rls-a" }).returning();
    const [b] = await ownerDb!.insert(schema.organizations).values({ name: "rls-b" }).returning();
    orgA = a.id;
    orgB = b.id;
    const [ba] = await ownerDb!.insert(schema.brands).values({ orgId: orgA, name: "A" }).returning();
    const [bb] = await ownerDb!.insert(schema.brands).values({ orgId: orgB, name: "B" }).returning();
    brandA = ba.id;
    brandB = bb.id;
    for (const [org, brand, hook] of [[orgA, brandA, "secret-A"], [orgB, brandB, "secret-B"]] as const) {
      await ownerDb!.insert(schema.drafts).values({ orgId: org, brandId: brand, platform: "LinkedIn", hook, body: "b", status: "draft" });
    }
  });

  afterAll(async () => {
    // Exhaustive on purpose. Deleting only what the first version of this file
    // happened to create left orphans behind, and the organization delete then
    // failed silently on a foreign key — so every run accumulated rows and the
    // next run's assertions were reading somebody else's leftovers.
    if (ownerSql && orgA) {
      for (const id of [orgA, orgB]) {
        for (const table of [
          "coupon_redemptions", "invoices", "social_connections", "media_assets",
          "products", "ideas", "analyses", "source_chunks", "sources",
          "drafts", "dna_versions", "credit_ledger", "jobs", "link_events",
          "memberships", "brands",
        ]) {
          await ownerSql.unsafe(`delete from ${table} where org_id = $1`, [id]);
        }
        await ownerSql`delete from organizations where id = ${id}::uuid`;
      }
    }
    await ownerSql?.end({ timeout: 3 });
    await rlsSql?.end({ timeout: 3 });
  });

  /** One transaction as the restricted role, with the given settings applied. */
  async function asRole<T>(settings: Record<string, string>, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
    return rlsSql!.begin(async (tx) => {
      for (const [k, v] of Object.entries(settings)) await tx`select set_config(${k}, ${v}, true)`;
      return fn(tx as unknown as postgres.TransactionSql);
    }) as Promise<T>;
  }

  // The whole point: an unscoped query is not a leak, it is an empty result.
  it("shows NOTHING when no scope is set", async () => {
    if (!ready) return;
    const rows = await asRole({}, (tx) => tx`select id from drafts`);
    expect(rows.length).toBe(0);
  });

  it("shows only the scoped workspace's rows", async () => {
    if (!ready) return;
    const rows = await asRole({ "app.org_id": orgA }, (tx) => tx`select hook, org_id from drafts`);
    expect(rows.map((r) => r.hook)).toEqual(["secret-A"]);
    expect(rows.every((r) => r.org_id === orgA)).toBe(true);
  });

  // A query that deliberately asks for the other tenant still gets nothing:
  // the policy is applied by the database, not by the query's own WHERE clause.
  it("cannot reach another workspace even by asking for it directly", async () => {
    if (!ready) return;
    const rows = await asRole({ "app.org_id": orgA }, (tx) => tx`select hook from drafts where org_id = ${orgB}::uuid`);
    expect(rows.length).toBe(0);
    const orgs = await asRole({ "app.org_id": orgA }, (tx) => tx`select id from organizations`);
    expect(orgs.map((r) => r.id)).toEqual([orgA]);
  });

  it("refuses to WRITE a row into another workspace", async () => {
    if (!ready) return;
    await expect(
      asRole({ "app.org_id": orgA }, (tx) => tx`
        insert into drafts (org_id, brand_id, platform, hook, body, status)
        values (${orgB}::uuid, ${brandB}::uuid, 'X', 'smuggled', 'b', 'draft')`),
    ).rejects.toThrow(/row-level security/i);
    // And nothing landed.
    const check = await ownerSql!`select count(*)::int as n from drafts where hook = 'smuggled'`;
    expect(check[0].n).toBe(0);
  });

  it("refuses to MOVE a row into another workspace", async () => {
    if (!ready) return;
    // The rewritten row fails the policy's WITH CHECK, so Postgres raises
    // rather than re-homing a draft under another tenant.
    await expect(
      asRole({ "app.org_id": orgA }, (tx) => tx`update drafts set org_id = ${orgB}::uuid returning id`),
    ).rejects.toThrow(/row-level security/i);
    const still = await ownerSql!`select org_id from drafts where hook = 'secret-A'`;
    expect(still[0].org_id).toBe(orgA);
  });

  it("lets the explicit system scope cross workspaces — and only that", async () => {
    if (!ready) return;
    const all = await asRole({ "app.system": "on" }, (tx) => tx`select hook from drafts where hook like 'secret-%'`);
    expect(all.map((r) => r.hook).sort()).toEqual(["secret-A", "secret-B"]);
  });

  // Proof that applying the migration to production changes nothing today.
  it("leaves the owning role unaffected, which is why this is safe to ship", async () => {
    if (!ready) return;
    const rows = await ownerSql!`select hook from drafts where hook like 'secret-%'`;
    expect(rows.length).toBe(2);
  });

  // The façade end of the contract: forOrg must set the scope itself.
  describe("through forOrg on the restricted connection", () => {
    it("reads its own workspace and nothing else", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      try {
        const a = await forOrg(rlsDb!, orgA).listDrafts(brandA);
        expect(a.map((d) => d.hook)).toEqual(["secret-A"]);
        // Asking org A's façade for org B's brand returns nothing — the façade
        // scopes, and the database agrees.
        expect(await forOrg(rlsDb!, orgA).listDrafts(brandB)).toEqual([]);
        expect((await forOrg(rlsDb!, orgB).listDrafts(brandB)).map((d) => d.hook)).toEqual(["secret-B"]);
      } finally {
        delete process.env.DB_RLS;
      }
    });

    it("still runs the credit ledger's advisory-lock transaction under RLS", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      try {
        const org = forOrg(rlsDb!, orgA);
        // appendLedger opens its own transaction; under RLS that becomes a
        // savepoint inside the scoped one. If nesting were broken, this throws.
        await org.grant(100, "rls_test_grant");
        expect(await org.balance()).toBe(100);
      } finally {
        delete process.env.DB_RLS;
      }
    });

    // Regression: a coupon's redemption counter lives on a PLATFORM-owned row,
    // not a tenant one. Under RLS the write policy on `coupons` is system-only,
    // so a plain UPDATE from tenant context silently affects zero rows — and a
    // counter that never moves makes max_redemptions unenforceable, i.e. one
    // coupon redeemable forever across every workspace.
    it("still increments a coupon's redemption counter", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      const code = `RLSTEST${Date.now().toString().slice(-6)}`;
      try {
        const [c] = await ownerDb!.insert(schema.coupons).values({ code, credits: 25, maxRedemptions: 1 }).returning();
        const res = await forOrg(rlsDb!, orgA).redeemCoupon(code);
        expect(res.ok).toBe(true);

        const [after] = await ownerDb!.select().from(schema.coupons).where(eq(schema.coupons.id, c.id));
        expect(after.redemptions).toBe(1);

        // And the cap now actually binds for the next workspace.
        const second = await forOrg(rlsDb!, orgB).redeemCoupon(code);
        expect(second).toMatchObject({ ok: false, error: "exhausted" });

        await ownerDb!.delete(schema.couponRedemptions).where(eq(schema.couponRedemptions.couponId, c.id));
        await ownerDb!.delete(schema.coupons).where(eq(schema.coupons.id, c.id));
      } finally {
        delete process.env.DB_RLS;
      }
    });

    // Regression: the handle uniqueness check reads across tenants. Under RLS
    // another workspace's handle is invisible, so the check passes and the
    // UPDATE hits the unique index — turning a clean "taken" into a raw
    // Postgres error surfaced to the user.
    it("reports a handle taken by ANOTHER workspace as taken, not as a crash", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      const handle = `rls-h-${Date.now().toString().slice(-6)}`;
      try {
        expect(await forOrg(rlsDb!, orgB).setHandle(brandB, handle)).toBe(true);
        expect(await forOrg(rlsDb!, orgA).setHandle(brandA, handle)).toBe(false);
        // B keeps it; A did not steal it.
        const [b] = await ownerDb!.select().from(schema.brands).where(eq(schema.brands.id, brandB));
        expect(b.handle).toBe(handle);
      } finally {
        delete process.env.DB_RLS;
      }
    });

    it("re-claiming your OWN handle still succeeds", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      const handle = `rls-own-${Date.now().toString().slice(-6)}`;
      try {
        expect(await forOrg(rlsDb!, orgA).setHandle(brandA, handle)).toBe(true);
        expect(await forOrg(rlsDb!, orgA).setHandle(brandA, handle)).toBe(true);
      } finally {
        delete process.env.DB_RLS;
      }
    });

    // Regression: the affiliate count reads OTHER orgs' rows (the ones this org
    // referred). The org policy hides them, so the number silently read zero.
    it("counts referred workspaces, which live outside this org's scope", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      try {
        await ownerDb!.update(schema.organizations).set({ referredBy: orgA }).where(eq(schema.organizations.id, orgB));
        const r = await forOrg(rlsDb!, orgA).getReferral();
        expect(r.count).toBe(1);
        expect(r.code).toMatch(/^AF/);
      } finally {
        await ownerDb!.update(schema.organizations).set({ referredBy: null }).where(eq(schema.organizations.id, orgB));
        delete process.env.DB_RLS;
      }
    });

    // The Stripe path. A webhook is delivered at least once, so the SECOND
    // delivery must land on the duplicate-key branch — which means a failed
    // INSERT inside the per-call RLS transaction. If that abort were not
    // contained, a replayed payment would 500 instead of being a no-op, and
    // Stripe would keep retrying it.
    it("treats a replayed keyed grant as a no-op under RLS, not an error", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      try {
        const org = forOrg(rlsDb!, orgB);
        const key = `rls_replay_${Date.now()}`;
        const first = await org.grantOnceKeyed(50, "purchase", key, "stripe");
        const second = await org.grantOnceKeyed(50, "purchase", key, "stripe");
        expect(second).toBe(first); // credited once, and the replay still answers
        expect(await org.balance()).toBe(first);
      } finally {
        delete process.env.DB_RLS;
      }
    });

    it("treats a replayed idempotent debit as a no-op under RLS", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      try {
        const org = forOrg(rlsDb!, orgB);
        const before = await org.balance();
        const key = `rls_debit_${Date.now()}`;
        await org.debitOnce(10, "ingest_source", key);
        const afterFirst = await org.balance();
        expect(afterFirst).toBe(before - 10);
        await org.debitOnce(10, "ingest_source", key);
        expect(await org.balance()).toBe(afterFirst);
      } finally {
        delete process.env.DB_RLS;
      }
    });

    it("treats a second redemption of the same coupon as 'already', not a crash", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      const code = `RLSDUP${Date.now().toString().slice(-6)}`;
      try {
        const [c] = await ownerDb!.insert(schema.coupons).values({ code, credits: 10, maxRedemptions: 5 }).returning();
        expect((await forOrg(rlsDb!, orgA).redeemCoupon(code)).ok).toBe(true);
        expect(await forOrg(rlsDb!, orgA).redeemCoupon(code)).toMatchObject({ ok: false, error: "already" });
        const [after] = await ownerDb!.select().from(schema.coupons).where(eq(schema.coupons.id, c.id));
        expect(after.redemptions).toBe(1); // the failed retry must not bump it
        await ownerDb!.delete(schema.couponRedemptions).where(eq(schema.couponRedemptions.couponId, c.id));
        await ownerDb!.delete(schema.coupons).where(eq(schema.coupons.id, c.id));
      } finally {
        delete process.env.DB_RLS;
      }
    });

    /**
     * A broad net rather than a list of the three bugs we happened to find.
     *
     * Every one of these reads its own workspace's data through the restricted
     * connection. Under RLS a method that reaches outside its scope does not
     * error — it silently returns nothing — so the only way to catch the next
     * one is to assert that real seeded data actually comes back.
     */
    it("returns real data for a representative spread of facade reads", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      try {
        const org = forOrg(rlsDb!, orgA);

        // Seed as the owner, read back through the restricted role.
        const [src] = await ownerDb!.insert(schema.sources).values({ orgId: orgA, brandId: brandA, kind: "text", title: "S1", status: "ready" }).returning();
        await ownerDb!.insert(schema.ideas).values({ orgId: orgA, brandId: brandA, title: "I1", angle: "a", postScore: 70 });
        await ownerDb!.insert(schema.mediaAssets).values({ orgId: orgA, brandId: brandA, kind: "image", url: "https://x/y.png" });
        await ownerDb!.insert(schema.products).values({ orgId: orgA, brandId: brandA, name: "P1" });
        await ownerDb!.insert(schema.invoices).values({
          orgId: orgA, stripeInvoiceId: `in_rls_${Date.now()}`, number: "RLS-1", status: "paid", currency: "usd",
          subtotalCents: 100, taxCents: 0, totalCents: 100, amountPaidCents: 100, issuedAt: new Date(),
        });
        await org.saveConnection(brandA, "linkedin", { accessToken: "t", externalAccountId: "urn:li:person:x" });

        expect((await org.currentBrand())?.id).toBe(brandA);
        expect((await org.listSources(brandA)).length).toBeGreaterThan(0);
        expect((await org.listIdeas(brandA)).length).toBeGreaterThan(0);
        expect((await org.listMediaAssets(brandA)).length).toBeGreaterThan(0);
        expect((await org.listProducts(brandA)).length).toBeGreaterThan(0);
        expect((await org.listInvoices()).length).toBeGreaterThan(0);
        expect((await org.listConnections(brandA)).length).toBeGreaterThan(0);
        expect(await org.getConnection(brandA, "linkedin")).not.toBeNull();
        expect((await org.counts(brandA)).sources).toBeGreaterThan(0);
        expect(await org.balance()).toBeGreaterThanOrEqual(0);
        expect((await org.listDrafts(brandA)).length).toBeGreaterThan(0);
        expect(await org.planState()).toBeTruthy();
        expect(await org.getLinkInfo(brandA)).toBeTruthy();
        expect(await org.linkStats(brandA)).toBeTruthy();

        await ownerDb!.delete(schema.sources).where(eq(schema.sources.id, src.id));
      } finally {
        delete process.env.DB_RLS;
      }
    });

    it("runs cross-org helpers through asSystem on the restricted connection", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      try {
        const rows = await asSystem(rlsDb!, (tx) =>
          tx.execute(sql`select count(*)::int as n from drafts where hook like 'secret-%'`),
        );
        expect((rows as unknown as { n: number }[])[0].n).toBe(2);
      } finally {
        delete process.env.DB_RLS;
      }
    });
  });
});

it.runIf(!ownerSql || !rlsSql)("skipped RLS: no database or no restricted role", () => {
  expect(true).toBe(true);
});
