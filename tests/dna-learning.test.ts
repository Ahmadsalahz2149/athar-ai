import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";
import { normalizeDna, normalizeLearnedFrom } from "@/lib/ai/normalize";
import { buildDnaUserMessage, type ContentDna } from "@/lib/ai/prompts";
import { buildHistoryRows, type StoredVersion } from "@/lib/dna/history";

/**
 * The closed loop: real performance reshapes the voice model.
 *
 * This is the one feature that changes how the customer sounds without them
 * asking for it, so the tests are mostly about the safeguards — the provenance
 * that lets them see WHY it changed, and the revert that lets them say no. A
 * learning loop with no veto is not a feature, it is something being done to
 * the user.
 */

describe("normalizeLearnedFrom", () => {
  it("keeps well-formed provenance", () => {
    expect(normalizeLearnedFrom([{ draftId: "d1", hook: "كيف تبدأ؟", engagement: 42 }])).toEqual([
      { hook: "كيف تبدأ؟", engagement: 42 },
    ]);
  });

  // This column is read by the very page that exists to let the user reject a
  // change, so a row written by an older or newer shape must degrade to "learned
  // from nothing" rather than break that page.
  it("degrades to nothing instead of throwing on a foreign shape", () => {
    expect(normalizeLearnedFrom(null)).toEqual([]);
    expect(normalizeLearnedFrom("[]")).toEqual([]);
    expect(normalizeLearnedFrom([null, 5, "x", {}])).toEqual([]);
    expect(normalizeLearnedFrom([{ hook: "only a hook" }])).toEqual([]);
  });

  it("drops entries whose engagement is not a real number", () => {
    expect(normalizeLearnedFrom([{ hook: "a", engagement: -3 }, { hook: "b", engagement: "x" }])).toEqual([]);
    expect(normalizeLearnedFrom([{ hook: "c", engagement: "12" }])).toEqual([{ hook: "c", engagement: 12 }]);
  });

  it("bounds what a single version can claim to have learned from", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ hook: `h${i}`, engagement: 1 }));
    expect(normalizeLearnedFrom(many)).toHaveLength(12);
    const long = normalizeLearnedFrom([{ hook: "ا".repeat(5000), engagement: 1 }]);
    expect(long[0].hook.length).toBeLessThanOrEqual(400);
  });
});

describe("buildDnaUserMessage", () => {
  it("passes proven posts in their own delimited block", () => {
    const msg = buildDnaUserMessage("sample text", "[1] a winning post");
    expect(msg).toContain("<SAMPLES>");
    expect(msg).toContain("<PROVEN>");
    expect(msg).toContain("[1] a winning post");
  });

  // No metrics yet is the normal case for a new account. The prompt must not
  // carry an empty block that implies the person has proven patterns.
  it("says nothing about proven patterns when there are none", () => {
    expect(buildDnaUserMessage("sample text")).not.toContain("<PROVEN>");
    expect(buildDnaUserMessage("sample text", "   ")).not.toContain("<PROVEN>");
  });
});

describe("buildHistoryRows", () => {
  const fmt = {
    date: (d: Date) => d.toISOString().slice(0, 10),
    complete: (pct: number) => `${pct}% complete`,
    learned: (n: number) => `learned from ${n}`,
    learnedNone: "sources only",
    engagement: (n: number) => `${n} engagement`,
  };
  const v = (over: Partial<StoredVersion> = {}): StoredVersion => ({
    id: "a", version: 1, completionPct: 70, learnedFromPosts: null, createdAt: new Date("2026-09-01T00:00:00Z"), ...over,
  });

  // Getting this backwards would offer a revert on the version already in use
  // and hide it on the one the user wants back — worse than no history at all.
  it("marks exactly the version the brand points at", () => {
    const rows = buildHistoryRows([v({ id: "b", version: 2 }), v({ id: "a", version: 1 })], 2, fmt);
    expect(rows.map((r) => r.current)).toEqual([true, false]);
  });

  it("marks nothing current when the brand has no current version", () => {
    const rows = buildHistoryRows([v({ version: 2 }), v()], null, fmt);
    expect(rows.every((r) => !r.current)).toBe(true);
  });

  it("formats every number through the caller's locale, not its own", () => {
    const rows = buildHistoryRows([v({ completionPct: 84, learnedFromPosts: [{ hook: "h", engagement: 12 }] })], 1, fmt);
    expect(rows[0].meta).toBe("2026-09-01 · 84% complete");
    expect(rows[0].learnedLabel).toBe("learned from 1");
    expect(rows[0].learnedFrom).toEqual([{ hook: "h", engagementLabel: "12 engagement" }]);
  });

  it("says a version came from sources alone rather than implying it learned from performance", () => {
    expect(buildHistoryRows([v()], 1, fmt)[0].learnedLabel).toBe("sources only");
    // Junk provenance must read the same way, not as a broken row.
    expect(buildHistoryRows([v({ learnedFromPosts: [{ nope: 1 }] })], 1, fmt)[0].learnedLabel).toBe("sources only");
  });
});

// --- Against a real database ------------------------------------------------

function loadEnv(key: string): string | null {
  const p = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const i = s.indexOf("=");
      if (i > 0 && s.slice(0, i).trim() === key) return s.slice(i + 1).trim();
    }
  }
  return process.env[key] ?? null;
}

const DATABASE_URL = loadEnv("DATABASE_URL");
const sql = DATABASE_URL ? postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 2 }) : null;
const db = sql ? drizzle(sql, { schema }) : null;

const dnaWith = (dialect: string): ContentDna => normalizeDna({ dialect, completion_pct: 60 });

let orgId = "";
let brandId = "";
let otherOrgId = "";
let otherBrandId = "";
let siblingBrandId = "";

describe.runIf(!!db)("DNA versions, provenance and revert", () => {
  beforeAll(async () => {
    const [o] = await db!.insert(schema.organizations).values({ name: "dna-learn" }).returning();
    orgId = o.id;
    const [b] = await db!.insert(schema.brands).values({ orgId, name: "dna-brand" }).returning();
    brandId = b.id;
    const [sib] = await db!.insert(schema.brands).values({ orgId, name: "dna-sibling" }).returning();
    siblingBrandId = sib.id;
    const [o2] = await db!.insert(schema.organizations).values({ name: "dna-learn-other" }).returning();
    otherOrgId = o2.id;
    const [b2] = await db!.insert(schema.brands).values({ orgId: otherOrgId, name: "other-brand" }).returning();
    otherBrandId = b2.id;
  });

  afterAll(async () => {
    if (!db) return;
    for (const id of [orgId, otherOrgId].filter(Boolean)) {
      await db.update(schema.brands).set({ currentDnaVersionId: null }).where(eq(schema.brands.orgId, id));
      await db.delete(schema.dnaVersions).where(eq(schema.dnaVersions.orgId, id));
      await db.delete(schema.brands).where(eq(schema.brands.orgId, id));
      await db.delete(schema.organizations).where(eq(schema.organizations.id, id));
    }
    await sql!.end({ timeout: 3 });
  });

  it("records which real posts a version learned from, and reads them back", async () => {
    const t = forOrg(db!, orgId);
    await t.saveDna(brandId, dnaWith("v1"));
    await t.saveDna(brandId, dnaWith("v2"), [
      { draftId: "00000000-0000-0000-0000-000000000001", hook: "الهوك الفائز", engagement: 96 },
      { draftId: "00000000-0000-0000-0000-000000000002", hook: "هوك آخر", engagement: 40 },
    ]);

    const versions = await t.dnaVersions(brandId);
    expect(versions.map((v) => v.version)).toEqual([2, 1]); // newest first
    expect(normalizeLearnedFrom(versions[0].learnedFromPosts)).toEqual([
      { hook: "الهوك الفائز", engagement: 96 },
      { hook: "هوك آخر", engagement: 40 },
    ]);
    // A version built before any metrics existed must not claim otherwise.
    expect(versions[1].learnedFromPosts).toBeNull();
  });

  it("puts a version back without erasing the one being rejected", async () => {
    const t = forOrg(db!, orgId);
    const versions = await t.dnaVersions(brandId);
    const v1 = versions.find((v) => v.version === 1)!;

    expect((await t.currentDna(brandId))?.dialect).toBe("v2");
    expect(await t.revertDna(brandId, v1.id)).toBe(true);
    expect((await t.currentDna(brandId))?.dialect).toBe("v1");

    // History is a record, not a working copy: the rejected version is still
    // there, and still visible, which is the point.
    const after = await t.dnaVersions(brandId);
    expect(after.map((v) => v.version)).toEqual([2, 1]);
    expect(await t.revertDna(brandId, after.find((v) => v.version === 2)!.id)).toBe(true);
    expect((await t.currentDna(brandId))?.dialect).toBe("v2");
  });

  // A forged id must not be able to adopt another workspace's voice — the whole
  // product is the customer's voice, and this is the write that sets it.
  it("refuses a version id belonging to another workspace", async () => {
    const other = forOrg(db!, otherOrgId);
    await other.saveDna(otherBrandId, dnaWith("theirs"));
    const theirVersion = (await other.dnaVersions(otherBrandId))[0];

    const t = forOrg(db!, orgId);
    expect(await t.revertDna(brandId, theirVersion.id)).toBe(false);
    expect((await t.currentDna(brandId))?.dialect).toBe("v2"); // untouched
    expect((await other.currentDna(otherBrandId))?.dialect).toBe("theirs");
  });

  it("refuses a version belonging to another brand in the same workspace", async () => {
    const t = forOrg(db!, orgId);
    await t.saveDna(siblingBrandId, dnaWith("sibling"));
    const sibVersion = (await t.dnaVersions(siblingBrandId))[0];

    expect(await t.revertDna(brandId, sibVersion.id)).toBe(false);
    expect((await t.currentDna(brandId))?.dialect).toBe("v2");
  });

  it("refuses an id that does not exist at all", async () => {
    const t = forOrg(db!, orgId);
    expect(await t.revertDna(brandId, "00000000-0000-0000-0000-0000000000ff")).toBe(false);
  });

  it("keeps each brand's version numbering to itself", async () => {
    const t = forOrg(db!, orgId);
    const sib = await t.dnaVersions(siblingBrandId);
    expect(sib).toHaveLength(1);
    expect(sib[0].version).toBe(1); // not 3, even though the org has three
  });
});
