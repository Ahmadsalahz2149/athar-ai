import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";
import { COSTS, START_GRANT, estimateStudio, estimateDna } from "@/lib/credits/costs";

// --- Pure credit math (no DB) — always runs, part of the ADR-010 acceptance harness ---
describe("credit math", () => {
  it("DNA estimate equals the DNA cost", () => {
    expect(estimateDna()).toBe(COSTS.dna);
  });

  it("Studio estimate = dna + count × draft", () => {
    expect(estimateStudio(3)).toBe(COSTS.dna + 3 * COSTS.draft);
    expect(estimateStudio(1)).toBe(COSTS.dna + 1 * COSTS.draft);
  });

  it("Studio count is clamped to 1..5", () => {
    expect(estimateStudio(0)).toBe(estimateStudio(1));
    expect(estimateStudio(99)).toBe(estimateStudio(5));
    expect(estimateStudio(-4)).toBe(estimateStudio(1));
  });

  it("the welcome grant covers at least one full Studio run", () => {
    expect(START_GRANT).toBeGreaterThanOrEqual(estimateStudio(5));
  });
});

// --- Ledger integration (grant/debit/balance) — needs a DATABASE_URL ---
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

let orgId = "";

describe.runIf(!!db)("credit ledger (append-only)", () => {
  beforeAll(async () => {
    const [o] = await db!.insert(schema.organizations).values({ name: "test-credits" }).returning();
    orgId = o.id;
  });

  afterAll(async () => {
    if (!db) return;
    if (orgId) {
      await db.delete(schema.creditLedger).where(eq(schema.creditLedger.orgId, orgId));
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
    }
    await sql!.end({ timeout: 3 });
  });

  it("starts at zero", async () => {
    expect(await forOrg(db!, orgId).balance()).toBe(0);
  });

  it("grant then debit nets correctly (balance = sum of deltas)", async () => {
    const t = forOrg(db!, orgId);
    await t.grant(START_GRANT, "signup_grant");
    expect(await t.balance()).toBe(START_GRANT);
    await t.debit(estimateStudio(3), "studio_generation");
    expect(await t.balance()).toBe(START_GRANT - estimateStudio(3));
  });

  it("debit never charges more than requested (abs) and stays consistent", async () => {
    const t = forOrg(db!, orgId);
    const before = await t.balance();
    await t.debit(-5, "weird_negative_input"); // Math.abs → charges 5
    expect(await t.balance()).toBe(before - 5);
  });

  it("debitOnce charges exactly once per idempotency key (no double-charge on retry)", async () => {
    const t = forOrg(db!, orgId);
    const before = await t.balance();
    const key = `ingest:src-${before}`;
    await t.debitOnce(7, "ingest_source", key); // first attempt
    const afterFirst = await t.balance();
    expect(afterFirst).toBe(before - 7);
    // A retry with the SAME key must not charge again.
    await t.debitOnce(7, "ingest_source", key);
    await t.debitOnce(7, "ingest_source", key);
    expect(await t.balance()).toBe(afterFirst);
  });
});

it.runIf(!db)("skipped ledger: no DATABASE_URL", () => {
  expect(true).toBe(true);
});
