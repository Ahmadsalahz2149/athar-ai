import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";
import { CREDIT_PACKS, findPack, packPriceUsd } from "@/lib/payments/catalog";
import { PLANS, findPlan, effectivePlan, FREE_PLAN } from "@/lib/payments/plans";

describe("credit pack catalog", () => {
  it("has unique ids and sane values", () => {
    const ids = CREDIT_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of CREDIT_PACKS) {
      expect(p.credits).toBeGreaterThan(0);
      expect(p.amountCents).toBeGreaterThan(0);
      // Cents, never dollars — a pack priced at 29 instead of 2900 would charge
      // 29 cents for 500 credits.
      expect(Number.isInteger(p.amountCents)).toBe(true);
      expect(p.amountCents).toBeGreaterThanOrEqual(100);
    }
  });

  it("resolves only known packs", () => {
    expect(findPack("pack_500")?.credits).toBe(500);
    expect(findPack("nope")).toBeUndefined();
    expect(findPack("")).toBeUndefined();
  });

  it("gets cheaper per credit as packs get bigger", () => {
    // Guards the pricing table itself: a bigger pack must never cost more per
    // credit than a smaller one, or the upsell is a downgrade.
    const rate = CREDIT_PACKS.map((p) => p.amountCents / p.credits);
    for (let i = 1; i < rate.length; i++) expect(rate[i]).toBeLessThanOrEqual(rate[i - 1]);
  });

  it("displays the price it charges", () => {
    for (const p of CREDIT_PACKS) expect(packPriceUsd(p) * 100).toBe(p.amountCents);
  });
});


describe("subscription plans", () => {
  it("every paid plan grants more than the free one", () => {
    for (const p of PLANS) {
      if (p.amountCents === 0) continue;
      expect(p.monthlyCredits).toBeGreaterThan(FREE_PLAN.monthlyCredits);
      expect(p.sourcesLimit).toBeGreaterThan(FREE_PLAN.sourcesLimit);
    }
  });

  it("costs more only when it gives more", () => {
    const paid = PLANS.filter((p) => p.amountCents > 0).sort((a, b) => a.amountCents - b.amountCents);
    for (let i = 1; i < paid.length; i++) {
      expect(paid[i].monthlyCredits).toBeGreaterThan(paid[i - 1].monthlyCredits);
      expect(paid[i].sourcesLimit).toBeGreaterThanOrEqual(paid[i - 1].sourcesLimit);
    }
  });

  it("entitles an active subscription", () => {
    for (const status of ["active", "trialing", "past_due"]) {
      expect(effectivePlan("pro", status).id).toBe("pro");
      expect(effectivePlan("pro", status).sourcesLimit).toBe(findPlan("pro")!.sourcesLimit);
    }
  });

  // Fail safe: anything that is not clearly a paid, in-good-standing
  // subscription must read as free. Getting this backwards would hand out paid
  // entitlements to lapsed or forged plan values.
  it("falls back to free for lapsed, unknown or missing state", () => {
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", null, undefined, ""]) {
      expect(effectivePlan("pro", status as string | null).id).toBe("free");
    }
    expect(effectivePlan("enterprise_unlimited", "active").id).toBe("free");
    expect(effectivePlan(null, "active").id).toBe("free");
    expect(effectivePlan(undefined, undefined).id).toBe("free");
    // A free plan never becomes paid, whatever status is claimed.
    expect(effectivePlan("free", "active").id).toBe("free");
  });
});

// --- Idempotent crediting (needs a DATABASE_URL) ---
function loadDatabaseUrl(): string | null {
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
const DATABASE_URL = loadDatabaseUrl();
const sqlc = DATABASE_URL ? postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 5 }) : null;
const db = sqlc ? drizzle(sqlc, { schema }) : null;
let orgId = "";

describe.runIf(!!db)("paid top-up crediting", () => {
  beforeAll(async () => {
    const [o] = await db!.insert(schema.organizations).values({ name: "pay-test" }).returning();
    orgId = o.id;
  });
  afterAll(async () => {
    if (!db) return;
    if (orgId) {
      await db.delete(schema.creditLedger).where(eq(schema.creditLedger.orgId, orgId));
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
    }
    await sqlc!.end({ timeout: 3 });
  });

  it("credits a purchase exactly once no matter how often the webhook is delivered", async () => {
    const t = forOrg(db!, orgId);
    const pack = CREDIT_PACKS[0];
    const key = `stripe:cs_test_ABC123`;

    const first = await t.grantOnceKeyed(pack.credits, "purchase", key, "stripe");
    expect(first).toBe(pack.credits);

    // Stripe delivers at least once and retries every non-2xx: replays must be
    // free, not free credits.
    for (let i = 0; i < 4; i++) {
      expect(await t.grantOnceKeyed(pack.credits, "purchase", key, "stripe")).toBe(pack.credits);
    }
    expect(await t.balance()).toBe(pack.credits);

    const rows = await sqlc!`select count(*)::int as n from credit_ledger where org_id = ${orgId} and idempotency_key = ${key}`;
    expect(rows[0].n).toBe(1);
  });

  it("credits each billing period once, and replays of an invoice are free", async () => {
    const t = forOrg(db!, orgId);
    const plan = findPlan("pro")!;
    const before = await t.balance();

    // Month 1 — delivered three times, as Stripe may.
    for (let i = 0; i < 3; i++) {
      await t.grantOnceKeyed(plan.monthlyCredits, "subscription_credits", "stripe_invoice:in_001", "stripe");
    }
    expect(await t.balance()).toBe(before + plan.monthlyCredits);

    // Month 2 is a DIFFERENT invoice, so it must credit again — otherwise a
    // subscriber stops receiving what they pay for after the first month.
    await t.grantOnceKeyed(plan.monthlyCredits, "subscription_credits", "stripe_invoice:in_002", "stripe");
    expect(await t.balance()).toBe(before + plan.monthlyCredits * 2);
  });

  it("treats a different payment as a separate purchase", async () => {
    const t = forOrg(db!, orgId);
    const before = await t.balance();
    const pack = CREDIT_PACKS[1];
    await t.grantOnceKeyed(pack.credits, "purchase", "stripe:cs_test_SECOND", "stripe");
    expect(await t.balance()).toBe(before + pack.credits);
  });

  it("survives concurrent deliveries of the same payment", async () => {
    const t = forOrg(db!, orgId);
    const before = await t.balance();
    const pack = CREDIT_PACKS[2];
    const key = "stripe:cs_test_RACE";
    // Stripe can have two retries in flight at once.
    await Promise.allSettled(Array.from({ length: 6 }, () => t.grantOnceKeyed(pack.credits, "purchase", key, "stripe")));
    expect(await t.balance()).toBe(before + pack.credits);
  });
});
