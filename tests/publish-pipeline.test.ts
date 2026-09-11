import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";
import { dispatchDuePublishes, requeueAbandonedPublishes, PUBLISH_JOB, PUBLISH_MAX_ATTEMPTS } from "@/lib/social/dispatch";
import { publishDraftHandler } from "@/lib/jobs/handlers/publishDraft";
import type { JobRow } from "@/lib/jobs/types";

/**
 * End-to-end publishing over a real database with the network stubbed: the
 * claim→job→publish→record path is where double-posting and lost posts would
 * live, and neither is visible in a pure unit test.
 */
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
const sql = DATABASE_URL ? postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 4 }) : null;
const db = sql ? drizzle(sql, { schema }) : null;

let orgId = "";
let brandId = "";

async function newDraft(fields: Partial<typeof schema.drafts.$inferInsert> = {}) {
  const [d] = await db!
    .insert(schema.drafts)
    .values({
      orgId, brandId,
      platform: "X / Twitter",
      hook: "عنوان تجريبي",
      body: "نص تجريبي قصير للنشر.",
      status: "scheduled",
      scheduledAt: new Date(Date.now() - 60_000),
      ...fields,
    })
    .returning();
  return d;
}

function jobFor(draftId: string, over: Partial<JobRow> = {}): JobRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    orgId, brandId, type: PUBLISH_JOB, status: "running",
    payload: { draftId }, progress: 0, phase: null,
    attempts: 1, maxAttempts: PUBLISH_MAX_ATTEMPTS,
    lastError: null, result: null, lockedAt: new Date(), lockedBy: "test",
    runAfter: new Date(), createdAt: new Date(), updatedAt: new Date(),
    ...over,
  };
}

const run = (job: JobRow) => publishDraftHandler({ db: db!, job, progress: async () => {} });

const statusOf = async (id: string) => {
  const [r] = await db!.select().from(schema.drafts).where(eq(schema.drafts.id, id));
  return r;
};

function stubFetch(responses: Array<{ status?: number; body?: unknown; headers?: Record<string, string> }>) {
  let i = 0;
  vi.stubGlobal("fetch", async () => {
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: r.headers });
  });
}

describe.runIf(!!db)("publishing pipeline", () => {
  beforeAll(async () => {
    const [o] = await db!.insert(schema.organizations).values({ name: "test-publish" }).returning();
    orgId = o.id;
    const [b] = await db!.insert(schema.brands).values({ orgId, name: "PB" }).returning();
    brandId = b.id;
  });

  beforeEach(async () => {
    await db!.delete(schema.jobs).where(eq(schema.jobs.orgId, orgId));
    await db!.delete(schema.drafts).where(eq(schema.drafts.orgId, orgId));
    await db!.delete(schema.socialConnections).where(eq(schema.socialConnections.orgId, orgId));
  });

  afterEach(() => vi.unstubAllGlobals());

  afterAll(async () => {
    if (!db) return;
    await db.delete(schema.jobs).where(eq(schema.jobs.orgId, orgId));
    await db.delete(schema.drafts).where(eq(schema.drafts.orgId, orgId));
    await db.delete(schema.socialConnections).where(eq(schema.socialConnections.orgId, orgId));
    await db.delete(schema.brands).where(eq(schema.brands.orgId, orgId));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
    await sql!.end({ timeout: 3 });
  });

  // --- Dispatcher ----------------------------------------------------------
  describe("dispatchDuePublishes", () => {
    it("claims a due draft and enqueues exactly one job for it", async () => {
      const d = await newDraft();
      expect(await dispatchDuePublishes(db!)).toBeGreaterThanOrEqual(1);

      expect((await statusOf(d.id)).status).toBe("publishing");
      const jobs = await db!.select().from(schema.jobs).where(and(eq(schema.jobs.orgId, orgId), eq(schema.jobs.type, PUBLISH_JOB)));
      expect(jobs).toHaveLength(1);
      expect(jobs[0].payload).toEqual({ draftId: d.id });
      expect(jobs[0].brandId).toBe(brandId);
      expect(jobs[0].maxAttempts).toBe(PUBLISH_MAX_ATTEMPTS);
    });

    // The whole point of the claim: a second pass (an overlapping cron, a retry)
    // must not produce a second live post.
    it("never claims the same draft twice", async () => {
      await newDraft();
      const first = await dispatchDuePublishes(db!);
      const second = await dispatchDuePublishes(db!);
      expect(first).toBe(1);
      expect(second).toBe(0);
      const jobs = await db!.select().from(schema.jobs).where(eq(schema.jobs.orgId, orgId));
      expect(jobs).toHaveLength(1);
    });

    it("leaves posts that are not due, not scheduled, or deleted alone", async () => {
      const future = await newDraft({ scheduledAt: new Date(Date.now() + 3_600_000) });
      const approved = await newDraft({ status: "approved" });
      const deleted = await newDraft({ deletedAt: new Date() });
      const noTime = await newDraft({ scheduledAt: null });

      expect(await dispatchDuePublishes(db!)).toBe(0);
      for (const d of [future, approved, deleted, noTime]) {
        expect((await statusOf(d.id)).status).not.toBe("publishing");
      }
    });
  });

  // --- Stranded-draft recovery --------------------------------------------
  describe("requeueAbandonedPublishes", () => {
    it("returns a draft to 'scheduled' when nothing is left to publish it", async () => {
      const d = await newDraft({ status: "publishing", scheduledAt: new Date(Date.now() - 3 * 3600_000) });
      expect(await requeueAbandonedPublishes(db!)).toBe(1);
      expect((await statusOf(d.id)).status).toBe("scheduled");
    });

    it("does not touch a draft whose job is still alive", async () => {
      const d = await newDraft({ status: "publishing", scheduledAt: new Date(Date.now() - 3 * 3600_000) });
      await db!.insert(schema.jobs).values({ orgId, brandId, type: PUBLISH_JOB, status: "queued", payload: { draftId: d.id } });
      expect(await requeueAbandonedPublishes(db!)).toBe(0);
      expect((await statusOf(d.id)).status).toBe("publishing");
    });

    it("does not touch a claim that is still recent", async () => {
      const d = await newDraft({ status: "publishing", scheduledAt: new Date(Date.now() - 60_000) });
      expect(await requeueAbandonedPublishes(db!)).toBe(0);
      expect((await statusOf(d.id)).status).toBe("publishing");
    });
  });

  // --- Draft text ----------------------------------------------------------
  /**
   * The Studio had no way to persist an edit at all: autosave and the Save
   * button both wrote a status. Since approvals, scheduling and publishing all
   * read the stored row, the model's original output is what went out — while
   * the UI said "saved". These are the tests that would have caught it.
   */
  describe("updateDraftText", () => {
    it("persists the edited text and its scores", async () => {
      const d = await newDraft({ status: "draft", hook: "old hook", body: "old body" });
      await forOrg(db!, orgId).updateDraftText(brandId, d.id, {
        hook: "عنوان محرَّر", body: "نص محرَّر", postScore: 88, dnaMatch: 74,
      });
      const row = await statusOf(d.id);
      expect(row.hook).toBe("عنوان محرَّر");
      expect(row.body).toBe("نص محرَّر");
      expect(row.postScore).toBe(88);
      expect(row.dnaMatch).toBe(74);
      expect(row.status).toBe("draft"); // saving text must not move the state
    });

    it("leaves the scores alone when they are not supplied", async () => {
      const d = await newDraft({ status: "draft", postScore: 55, dnaMatch: 44 });
      await forOrg(db!, orgId).updateDraftText(brandId, d.id, { hook: "h", body: "b" });
      const row = await statusOf(d.id);
      expect(row.postScore).toBe(55);
      expect(row.dnaMatch).toBe(44);
    });

    // A published row is a record of what was actually posted to a platform.
    it("refuses to rewrite a published post", async () => {
      const d = await newDraft({ status: "published", hook: "as published", body: "live text" });
      await forOrg(db!, orgId).updateDraftText(brandId, d.id, { hook: "tampered", body: "tampered" });
      const row = await statusOf(d.id);
      expect(row.hook).toBe("as published");
      expect(row.body).toBe("live text");
    });

    it("cannot touch another workspace's draft", async () => {
      const [other] = await db!.insert(schema.organizations).values({ name: "text-other" }).returning();
      const [ob] = await db!.insert(schema.brands).values({ orgId: other.id, name: "O" }).returning();
      const [od] = await db!
        .insert(schema.drafts)
        .values({ orgId: other.id, brandId: ob.id, platform: "LinkedIn", hook: "theirs", body: "theirs", status: "draft" })
        .returning();

      await forOrg(db!, orgId).updateDraftText(brandId, od.id, { hook: "stolen", body: "stolen" });

      const [row] = await db!.select().from(schema.drafts).where(eq(schema.drafts.id, od.id));
      expect(row.hook).toBe("theirs");

      await db!.delete(schema.drafts).where(eq(schema.drafts.orgId, other.id));
      await db!.delete(schema.brands).where(eq(schema.brands.orgId, other.id));
      await db!.delete(schema.organizations).where(eq(schema.organizations.id, other.id));
    });

    // The consequence that made this a publishing bug and not just a UX one.
    it("is what the publisher then sends", async () => {
      await forOrg(db!, orgId).saveConnection(brandId, "x", { accessToken: "tok", externalAccountId: "acct" });
      const d = await newDraft({ status: "draft", hook: "generated", body: "generated" });
      await forOrg(db!, orgId).updateDraftText(brandId, d.id, { hook: "ما كتبه المستخدم", body: "النص النهائي" });
      await db!.update(schema.drafts).set({ status: "publishing" }).where(eq(schema.drafts.id, d.id));

      let sent = "";
      vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
        sent = JSON.parse(init.body as string).text;
        return new Response(JSON.stringify({ data: { id: "1" } }), { status: 201 });
      });
      await run(jobFor(d.id));
      expect(sent).toBe("ما كتبه المستخدم\n\nالنص النهائي");
    });
  });

  // --- Handler -------------------------------------------------------------
  describe("publish_draft handler", () => {
    const connect = (over: Partial<{ accessToken: string; expiresAt: Date | null; externalAccountId: string | null }> = {}) =>
      forOrg(db!, orgId).saveConnection(brandId, "x", { accessToken: "tok", externalAccountId: "acct", ...over });

    it("publishes and records the live post", async () => {
      await connect();
      const d = await newDraft({ status: "publishing" });
      stubFetch([{ status: 201, body: { data: { id: "555" } } }]);

      const out = await run(jobFor(d.id));
      expect(out).toMatchObject({ published: true, externalPostId: "555" });

      const row = await statusOf(d.id);
      expect(row.status).toBe("published");
      expect(row.externalPostId).toBe("555");
      expect(row.externalUrl).toBe("https://x.com/i/web/status/555");
      expect(row.publishedAt).toBeInstanceOf(Date);
      expect(row.publishError).toBeNull();
    });

    it("tells the user to connect an account instead of retrying forever", async () => {
      const d = await newDraft({ status: "publishing" });
      const out = await run(jobFor(d.id));
      expect(out).toMatchObject({ published: false, reason: "not_connected:x" });
      const row = await statusOf(d.id);
      expect(row.status).toBe("publish_failed");
      expect(row.publishError).toBe("not_connected:x");
    });

    it("flags the connection for re-auth when the token is revoked", async () => {
      await connect();
      const d = await newDraft({ status: "publishing" });
      stubFetch([{ status: 401, body: { title: "Unauthorized" } }]);

      await run(jobFor(d.id));
      expect((await statusOf(d.id)).status).toBe("publish_failed");
      const conn = await forOrg(db!, orgId).getConnection(brandId, "x");
      expect(conn?.status).toBe("expired");
    });

    it("retries a server fault without telling the user it failed", async () => {
      await connect();
      const d = await newDraft({ status: "publishing" });
      stubFetch([{ status: 503, body: {} }]);

      await expect(run(jobFor(d.id, { attempts: 1 }))).rejects.toMatchObject({ retryable: true });
      const row = await statusOf(d.id);
      // Still in flight: the queue will try again, so the calendar must not yet
      // show a failure the retry is about to undo.
      expect(row.status).toBe("publishing");
      expect(row.publishError).toBeNull();
    });

    it("records the failure once the last attempt is spent", async () => {
      await connect();
      const d = await newDraft({ status: "publishing" });
      stubFetch([{ status: 503, body: {} }]);

      await expect(run(jobFor(d.id, { attempts: PUBLISH_MAX_ATTEMPTS }))).rejects.toBeTruthy();
      const row = await statusOf(d.id);
      expect(row.status).toBe("publish_failed");
      expect(row.publishError).toContain("x:");
    });

    it("does nothing for a draft that is no longer claimed", async () => {
      await connect();
      const d = await newDraft({ status: "approved" });
      let called = false;
      vi.stubGlobal("fetch", async () => { called = true; return new Response("{}"); });

      const out = await run(jobFor(d.id));
      expect(out).toMatchObject({ published: false, reason: "not_claimed:approved" });
      expect(called).toBe(false);
    });

    it("refuses a platform it cannot publish to", async () => {
      const d = await newDraft({ status: "publishing", platform: "TikTok" });
      const out = await run(jobFor(d.id));
      expect(out).toMatchObject({ reason: "unsupported_platform:TikTok" });
      expect((await statusOf(d.id)).status).toBe("publish_failed");
    });

    it("refreshes an expiring token before posting and stores the rotated one", async () => {
      await connect({ expiresAt: new Date(Date.now() + 1000) });
      await db!.update(schema.socialConnections).set({ refreshToken: "r1" })
        .where(and(eq(schema.socialConnections.orgId, orgId), eq(schema.socialConnections.platform, "x")));
      const d = await newDraft({ status: "publishing" });
      stubFetch([
        { body: { access_token: "tok2", refresh_token: "r2", expires_in: 7200 } }, // refresh
        { status: 201, body: { data: { id: "777" } } }, // tweet
      ]);

      await run(jobFor(d.id));
      const conn = await forOrg(db!, orgId).getConnection(brandId, "x");
      expect(conn?.accessToken).toBe("tok2");
      expect(conn?.refreshToken).toBe("r2"); // X rotates — keeping r1 breaks the next refresh
      expect((await statusOf(d.id)).status).toBe("published");
    });

    it("marks a draft whose text no longer fits the platform, without posting", async () => {
      await connect();
      const d = await newDraft({ status: "publishing", body: "ا".repeat(400) });
      let called = false;
      vi.stubGlobal("fetch", async () => { called = true; return new Response("{}"); });

      await run(jobFor(d.id));
      expect(called).toBe(false);
      const row = await statusOf(d.id);
      expect(row.status).toBe("publish_failed");
      expect(row.publishError).toMatch(/too_long/);
    });
  });
});

it.runIf(!db)("skipped publishing pipeline: no DATABASE_URL", () => {
  expect(true).toBe(true);
});
