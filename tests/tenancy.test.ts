import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";
import type { ContentDna } from "@/lib/ai/prompts";

// Load DATABASE_URL from .env.local (vitest doesn't auto-load it).
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
const sql = DATABASE_URL
  ? postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 2 })
  : null;
const db = sql ? drizzle(sql, { schema }) : null;

const DNA: ContentDna = {
  summary: "s", dialect: "d", tone_traits: ["t"], hook_patterns: ["h"],
  audience: "a", dos: [], donts: [], explanation_style: "e", sentence_length: 2,
  boldness: 2, awareness: "aw", cares_about: [], cta_patterns: [],
  pillars: { educational: 35, story: 20, proof: 15, soft_sell: 12, thought_leadership: 10, engagement: 8 },
  completion_pct: 50,
};

// A 2-brand-org tenancy proof: org A (2 brands) and org B (1 brand).
let orgA = "", orgB = "", brandA1 = "", brandB = "";

describe.runIf(!!db)("tenancy façade (db.forOrg)", () => {
  beforeAll(async () => {
    const [oa] = await db!.insert(schema.organizations).values({ name: "test-A" }).returning();
    const [ob] = await db!.insert(schema.organizations).values({ name: "test-B" }).returning();
    orgA = oa.id; orgB = ob.id;
    const [ba1] = await db!.insert(schema.brands).values({ orgId: orgA, name: "A1" }).returning();
    await db!.insert(schema.brands).values({ orgId: orgA, name: "A2" });
    const [bb] = await db!.insert(schema.brands).values({ orgId: orgB, name: "B" }).returning();
    brandA1 = ba1.id; brandB = bb.id;
    // Seed B's own data via B's façade.
    const B = forOrg(db!, orgB);
    await B.saveDna(brandB, DNA);
    await B.saveDraft(brandB, { platform: "X", hook: "secretB", body: "bodyB" });
  });

  afterAll(async () => {
    if (!db) return;
    for (const oid of [orgA, orgB].filter(Boolean)) {
      const brs = await db.select().from(schema.brands).where(eq(schema.brands.orgId, oid));
      for (const b of brs) {
        await db.update(schema.brands).set({ currentDnaVersionId: null }).where(eq(schema.brands.id, b.id));
        await db.delete(schema.drafts).where(eq(schema.drafts.brandId, b.id));
        await db.delete(schema.dnaVersions).where(eq(schema.dnaVersions.brandId, b.id));
      }
      await db.delete(schema.brands).where(eq(schema.brands.orgId, oid));
      await db.delete(schema.memberships).where(eq(schema.memberships.orgId, oid));
      await db.delete(schema.organizations).where(eq(schema.organizations.id, oid));
    }
    await sql!.end({ timeout: 3 });
  });

  it("A can read its own brand data", async () => {
    const A = forOrg(db!, orgA);
    await A.saveDna(brandA1, DNA);
    expect(await A.currentDna(brandA1)).not.toBeNull();
  });

  it("A CANNOT read B's DNA", async () => {
    const A = forOrg(db!, orgA);
    expect(await A.currentDna(brandB)).toBeNull();
  });

  it("A CANNOT read B's drafts", async () => {
    const A = forOrg(db!, orgA);
    const rows = await A.listDrafts(brandB);
    expect(rows.length).toBe(0);
  });

  it("A CANNOT write to B's brand", async () => {
    const A = forOrg(db!, orgA);
    await expect(A.saveDraft(brandB, { platform: "X", hook: "x", body: "y" })).rejects.toThrow();
    await expect(A.saveDna(brandB, DNA)).rejects.toThrow();
  });

  it("B still sees only its own draft after A's activity", async () => {
    const B = forOrg(db!, orgB);
    const rows = await B.listDrafts(brandB);
    expect(rows.length).toBe(1);
    expect(rows[0].hook).toBe("secretB");
  });
});

it.runIf(!db)("skipped: no DATABASE_URL", () => {
  expect(true).toBe(true);
});
