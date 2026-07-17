import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";

/** Exercises EVERY façade read/write path added in Phases 1–6 against a real
 * database, so a broken query/column surfaces here instead of as a 500 on a page. */

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
const sql = DATABASE_URL
  ? postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 2 })
  : null;
const db = sql ? drizzle(sql, { schema }) : null;

let orgId = "";
let brandId = "";

describe.runIf(!!db)("smoke: every façade query runs (Phases 1–6)", () => {
  beforeAll(async () => {
    const [o] = await db!.insert(schema.organizations).values({ name: "smoke" }).returning();
    orgId = o.id;
    const [b] = await db!.insert(schema.brands).values({ orgId, name: "smoke-brand" }).returning();
    brandId = b.id;
  });

  afterAll(async () => {
    if (!db || !orgId) return;
    await db.delete(schema.drafts).where(eq(schema.drafts.orgId, orgId));
    await db.delete(schema.ideas).where(eq(schema.ideas.orgId, orgId));
    await db.delete(schema.analyses).where(eq(schema.analyses.orgId, orgId));
    await db.delete(schema.sourceChunks).where(eq(schema.sourceChunks.orgId, orgId));
    await db.delete(schema.sources).where(eq(schema.sources.orgId, orgId));
    await db.delete(schema.creditLedger).where(eq(schema.creditLedger.orgId, orgId));
    await db.delete(schema.brands).where(eq(schema.brands.orgId, orgId));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
    await sql!.end({ timeout: 3 });
  });

  it("Vault: listSources + getSource + sourceChunkTexts", async () => {
    const t = forOrg(db!, orgId);
    expect(await t.listSources(brandId)).toEqual([]);
    const sid = await t.saveSource(brandId, { kind: "text", title: "smoke src" });
    const list = await t.listSources(brandId);
    expect(list).toHaveLength(1);
    expect(list[0].chunks).toBe(0);
    expect(list[0].analyzed).toBe(false);
    expect((await t.getSource(brandId, sid))?.title).toBe("smoke src");
    expect(await t.sourceChunkTexts(brandId, sid)).toEqual([]);
  });

  it("Analysis: save + get", async () => {
    const t = forOrg(db!, orgId);
    const sid = await t.saveSource(brandId, { kind: "text", title: "a" });
    await t.saveAnalysis(brandId, sid, {
      summary: "s",
      keyIdeas: ["i1"],
      quotes: ["q1"],
      audience: ["p1"],
      opportunities: ["o1"],
    });
    const got = await t.getAnalysis(brandId, sid);
    expect(got?.summary).toBe("s");
    expect((got?.keyIdeas as string[])[0]).toBe("i1");
    // listSources now reports analyzed=true for it
    const list = await t.listSources(brandId);
    expect(list.find((x) => x.id === sid)?.analyzed).toBe(true);
  });

  it("Ideas: saveIdeas + listIdeas + setIdeaStatus", async () => {
    const t = forOrg(db!, orgId);
    expect(await t.saveIdeas(brandId, [{ title: "idea A", angle: "x", postScore: 70 }])).toBe(1);
    const ideas = await t.listIdeas(brandId);
    expect(ideas).toHaveLength(1);
    await t.setIdeaStatus(brandId, ideas[0].id, "saved");
    expect((await t.listIdeas(brandId, { status: "saved" }))).toHaveLength(1);
  });

  it("Drafts: saveDraft with scores + status transitions + scheduled", async () => {
    const t = forOrg(db!, orgId);
    const id = await t.saveDraft(brandId, {
      platform: "LinkedIn",
      hook: "h",
      body: "b",
      postScore: 80,
      dnaMatch: 70,
    });
    expect((await t.listDraftsByStatus(brandId, "draft"))).toHaveLength(1);
    await t.setDraftStatus(brandId, id, "pending");
    expect((await t.listDraftsByStatus(brandId, "pending"))).toHaveLength(1);
    await t.setDraftStatus(brandId, id, "scheduled", new Date());
    const sched = await t.scheduledDrafts(brandId);
    expect(sched).toHaveLength(1);
    expect(sched[0].scheduledAt).toBeTruthy();
    expect(sched[0].postScore).toBe(80);
  });

  it("Dashboard: counts returns live numbers", async () => {
    const t = forOrg(db!, orgId);
    const c = await t.counts(brandId);
    expect(c.sources).toBeGreaterThanOrEqual(2);
    expect(c.ideas).toBe(1);
    expect(c.drafts).toBe(1);
    expect(c.scheduled).toBe(1);
    expect(c.pending).toBe(0);
  });
});

it.runIf(!db)("skipped smoke: no DATABASE_URL", () => {
  expect(true).toBe(true);
});
