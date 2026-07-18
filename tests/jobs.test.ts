import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";
import { claimNext, complete, fail, setProgress } from "@/lib/jobs/queue";
import { registerHandler, runOne } from "@/lib/jobs/runner";
import { backoffSeconds, type JobRow } from "@/lib/jobs/types";

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
  ? postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 3 })
  : null;
const db = sql ? drizzle(sql, { schema }) : null;

let orgId = "", brandId = "";
const jobIds: string[] = [];

describe.runIf(!!db)("job queue (lib/jobs)", () => {
  beforeAll(async () => {
    const [o] = await db!.insert(schema.organizations).values({ name: "test-jobs" }).returning();
    orgId = o.id;
    const [b] = await db!.insert(schema.brands).values({ orgId, name: "JB" }).returning();
    brandId = b.id;
  });

  afterAll(async () => {
    if (!db) return;
    if (jobIds.length) await db.delete(schema.jobs).where(inArray(schema.jobs.id, jobIds));
    await db.delete(schema.jobs).where(eq(schema.jobs.orgId, orgId));
    await db.delete(schema.brands).where(eq(schema.brands.id, brandId));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
    await sql!.end({ timeout: 3 });
  });

  it("enqueue → claim → complete happy path", async () => {
    const id = await forOrg(db!, orgId).enqueueJob(brandId, "test_noop", { hello: "world" });
    jobIds.push(id);
    const claimed = await claimNext(db!, "worker-1");
    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(id);
    expect(claimed!.status).toBe("running");
    expect(claimed!.attempts).toBe(1);
    expect((claimed!.payload as { hello: string }).hello).toBe("world");

    await setProgress(db!, id, 50, "halfway");
    await complete(db!, id, { done: true });
    const job = await forOrg(db!, orgId).getJob(brandId, id);
    expect(job!.status).toBe("done");
    expect(job!.progress).toBe(100);
    expect((job!.result as { done: boolean }).done).toBe(true);
  });

  it("SKIP LOCKED: two claims never grab the same job", async () => {
    const id = await forOrg(db!, orgId).enqueueJob(brandId, "test_noop");
    jobIds.push(id);
    // Only one job is runnable; a second concurrent claim must get null.
    const [a, b] = await Promise.all([claimNext(db!, "w-a"), claimNext(db!, "w-b")]);
    const got = [a, b].filter(Boolean) as JobRow[];
    expect(got.length).toBe(1);
    expect(got[0].id).toBe(id);
    await complete(db!, id);
  });

  it("fail retries with backoff, then dead-letters at max_attempts", async () => {
    const id = await forOrg(db!, orgId).enqueueJob(brandId, "test_fail", {}, { maxAttempts: 2 });
    jobIds.push(id);

    const c1 = await claimNext(db!, "w"); // attempts = 1
    expect(c1!.id).toBe(id);
    await fail(db!, c1!, "boom");
    let job = await forOrg(db!, orgId).getJob(brandId, id);
    expect(job!.status).toBe("queued"); // retry scheduled
    expect(job!.lastError).toBe("boom");

    // run_after was pushed into the future by backoff → not immediately claimable.
    const immediate = await claimNext(db!, "w");
    expect(immediate).toBeNull();
    expect(backoffSeconds(1)).toBeGreaterThan(0);

    // Force it due, claim again (attempts = 2 = max) → fail → dead.
    await db!.update(schema.jobs).set({ runAfter: new Date(Date.now() - 1000) }).where(eq(schema.jobs.id, id));
    const c2 = await claimNext(db!, "w");
    expect(c2!.attempts).toBe(2);
    await fail(db!, c2!, "boom again");
    job = await forOrg(db!, orgId).getJob(brandId, id);
    expect(job!.status).toBe("dead");
  });

  it("runOne dispatches to the registered handler and reports progress", async () => {
    let sawProgress = -1;
    registerHandler("test_handler", async ({ progress }) => {
      await progress(42, "working");
      sawProgress = 42;
      return { handled: true };
    });
    const id = await forOrg(db!, orgId).enqueueJob(brandId, "test_handler");
    jobIds.push(id);
    const outcome = await runOne(db!, "w");
    expect(outcome).toBe("ok");
    expect(sawProgress).toBe(42);
    const job = await forOrg(db!, orgId).getJob(brandId, id);
    expect(job!.status).toBe("done");
    expect((job!.result as { handled: boolean }).handled).toBe(true);
  });

  it("runOne dead-letters a job with no handler", async () => {
    const id = await forOrg(db!, orgId).enqueueJob(brandId, "no_such_handler", {}, { maxAttempts: 1 });
    jobIds.push(id);
    const outcome = await runOne(db!, "w");
    expect(outcome).toBe("no_handler");
    const job = await forOrg(db!, orgId).getJob(brandId, id);
    expect(job!.status).toBe("dead");
  });

  it("activeJobs is tenancy-scoped", async () => {
    const id = await forOrg(db!, orgId).enqueueJob(brandId, "test_noop");
    jobIds.push(id);
    const mine = await forOrg(db!, orgId).activeJobs(brandId);
    expect(mine.some((j) => j.id === id)).toBe(true);
    // A different org sees nothing of ours.
    const [other] = await db!.insert(schema.organizations).values({ name: "test-jobs-other" }).returning();
    const otherActive = await forOrg(db!, other.id).activeJobs(brandId);
    expect(otherActive.length).toBe(0);
    await db!.delete(schema.organizations).where(eq(schema.organizations.id, other.id));
    await complete(db!, id);
  });
});
