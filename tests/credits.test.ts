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
let concurrentOrgId = "";
let raceOrgId = "";

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
    if (concurrentOrgId) {
      await db.delete(schema.creditLedger).where(eq(schema.creditLedger.orgId, concurrentOrgId));
      await db.delete(schema.organizations).where(eq(schema.organizations.id, concurrentOrgId));
    }
    if (raceOrgId) {
      await db.delete(schema.creditLedger).where(eq(schema.creditLedger.orgId, raceOrgId));
      await db.delete(schema.organizations).where(eq(schema.organizations.id, raceOrgId));
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

  it("serializes concurrent debits and never lets a balance go negative", async () => {
    const [o] = await db!.insert(schema.organizations).values({ name: "test-concurrent-credits" }).returning();
    concurrentOrgId = o.id;
    const t = forOrg(db!, concurrentOrgId);
    await t.grant(10, "test_grant");

    const attempts = await Promise.allSettled([
      t.debit(7, "parallel_debit_a"),
      t.debit(7, "parallel_debit_b"),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    expect(await t.balance()).toBe(3);
  });

  // Regression: the two-debit test above still passed while the ledger was
  // broken — this file's pool is capped at 2 connections, so the debits never
  // truly raced. The stale-snapshot bug (advisory lock taken inside the same
  // INSERT statement) only appears with enough real connections: 20 concurrent
  // debits of 10 against a balance of 100 all committed, ending at -100.
  it("holds the balance under real concurrency (wider pool)", async () => {
    const pool = postgres(DATABASE_URL!, { ssl: { rejectUnauthorized: false }, prepare: false, max: 20 });
    try {
      const wide = drizzle(pool, { schema });
      const [o] = await wide.insert(schema.organizations).values({ name: "test-credits-race" }).returning();
      raceOrgId = o.id;
      const t = forOrg(wide, raceOrgId);
      await t.grant(100, "test_grant");

      const results = await Promise.allSettled(
        Array.from({ length: 20 }, (_, i) => t.debit(10, `race_debit_${i}`)),
      );
      // Exactly ten debits of 10 fit in a balance of 100; the rest must fail.
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
      expect(await t.balance()).toBe(0);

      const rows = await pool`select coalesce(sum(delta), 0)::int as s from credit_ledger where org_id = ${raceOrgId}::uuid`;
      expect(rows[0].s).toBe(0); // true ledger sum never went negative
    } finally {
      await pool.end({ timeout: 5 });
    }
  });
});

it.runIf(!db)("skipped ledger: no DATABASE_URL", () => {
  expect(true).toBe(true);
});
