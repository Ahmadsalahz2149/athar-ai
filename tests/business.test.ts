import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";

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
const sql = DATABASE_URL ? postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 2 }) : null;
const db = sql ? drizzle(sql, { schema }) : null;

let orgA = "", orgB = "", brandA = "", brandB = "", couponId = "", exhaustedId = "";
const CODE = "TEST" + Math.abs(Date.now() % 100000);
const EXH = "EXH" + Math.abs(Date.now() % 100000);

describe.runIf(!!db)("business logic (coupons, handles, referral)", () => {
  beforeAll(async () => {
    const [oa] = await db!.insert(schema.organizations).values({ name: "biz-A" }).returning();
    const [ob] = await db!.insert(schema.organizations).values({ name: "biz-B" }).returning();
    orgA = oa.id; orgB = ob.id;
    const [ba] = await db!.insert(schema.brands).values({ orgId: orgA, name: "bA" }).returning();
    const [bb] = await db!.insert(schema.brands).values({ orgId: orgB, name: "bB" }).returning();
    brandA = ba.id; brandB = bb.id;
    const [c] = await db!.insert(schema.coupons).values({ code: CODE, credits: 50, maxRedemptions: 5 }).returning();
    const [e] = await db!.insert(schema.coupons).values({ code: EXH, credits: 10, maxRedemptions: 1, redemptions: 1 }).returning();
    couponId = c.id; exhaustedId = e.id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(schema.couponRedemptions).where(inArray(schema.couponRedemptions.orgId, [orgA, orgB]));
    await db.delete(schema.creditLedger).where(inArray(schema.creditLedger.orgId, [orgA, orgB]));
    await db.delete(schema.dismissedSuggestions).where(inArray(schema.dismissedSuggestions.orgId, [orgA, orgB]));
    await db.delete(schema.coupons).where(inArray(schema.coupons.id, [couponId, exhaustedId]));
    await db.delete(schema.brands).where(inArray(schema.brands.id, [brandA, brandB]));
    await db.delete(schema.organizations).where(inArray(schema.organizations.id, [orgA, orgB]));
    await sql!.end();
  });

  it("redeems a coupon once and grants credits", async () => {
    const r = await forOrg(db!, orgA).redeemCoupon(CODE.toLowerCase()); // case-insensitive
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.credits).toBe(50); expect(r.balance).toBe(50); }
  });

  it("blocks a second redemption by the same org (idempotent)", async () => {
    const r = await forOrg(db!, orgA).redeemCoupon(CODE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("already");
    // balance unchanged
    expect(await forOrg(db!, orgA).balance()).toBe(50);
  });

  it("lets a different org redeem the same code", async () => {
    const r = await forOrg(db!, orgB).redeemCoupon(CODE);
    expect(r.ok).toBe(true);
  });

  it("rejects invalid and exhausted codes", async () => {
    const bad = await forOrg(db!, orgA).redeemCoupon("NOPE_NOPE");
    expect(bad.ok).toBe(false);
    const exh = await forOrg(db!, orgB).redeemCoupon(EXH);
    expect(exh.ok).toBe(false);
    if (!exh.ok) expect(exh.error).toBe("exhausted");
  });

  it("enforces handle uniqueness across brands", async () => {
    const first = await forOrg(db!, orgA).setHandle(brandA, "biztest");
    expect(first).toBe(true);
    const clash = await forOrg(db!, orgB).setHandle(brandB, "biztest"); // taken
    expect(clash).toBe(false);
    const reself = await forOrg(db!, orgA).setHandle(brandA, "biztest"); // own handle again = ok
    expect(reself).toBe(true);
  });

  it("generates a stable referral code", async () => {
    const a = await forOrg(db!, orgA).getReferral();
    const b = await forOrg(db!, orgA).getReferral();
    expect(a.code).toBeTruthy();
    expect(a.code).toBe(b.code);
    expect(a.count).toBe(0);
  });
});
