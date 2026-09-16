import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";
import { dispatchDuePublishes, dispatchDueMetrics, requeueAbandonedPublishes, PUBLISH_JOB, PUBLISH_MAX_ATTEMPTS, METRICS_JOB } from "@/lib/social/dispatch";
import { publishDraftHandler } from "@/lib/jobs/handlers/publishDraft";
import { collectMetricsHandler } from "@/lib/jobs/handlers/collectMetrics";
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
const collect = (job: JobRow) => collectMetricsHandler({ db: db!, job, progress: async () => {} });

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
    await db!.delete(schema.postMetrics).where(eq(schema.postMetrics.orgId, orgId));
    await db!.delete(schema.socialConnections).where(eq(schema.socialConnections.orgId, orgId));
  });

  afterEach(() => vi.unstubAllGlobals());

  afterAll(async () => {
    if (!db) return;
    await db.delete(schema.jobs).where(eq(schema.jobs.orgId, orgId));
    await db.delete(schema.postMetrics).where(eq(schema.postMetrics.orgId, orgId));
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

  // --- Metrics collection ---------------------------------------------------
  /**
   * The step that turns "we posted it" into "here is what happened". Everything
   * downstream — the performance analytics and the DNA learning from real
   * results rather than our own guess — reads what this writes.
   */
  describe("metrics collection", () => {
    const published = (over: Partial<typeof schema.drafts.$inferInsert> = {}) =>
      newDraft({
        status: "published",
        externalPostId: "ext_1",
        publishedAt: new Date(Date.now() - 3600_000),
        scheduledAt: new Date(Date.now() - 3600_000),
        ...over,
      });

    const stubMetrics = (body: unknown, status = 200) =>
      vi.stubGlobal("fetch", async () => new Response(JSON.stringify(body), { status }));

    const metricsOf = async (draftId: string) =>
      db!.select().from(schema.postMetrics).where(eq(schema.postMetrics.draftId, draftId));

    describe("dispatchDueMetrics", () => {
      it("queues a collection for a published post with no snapshot today", async () => {
        const d = await published();
        expect(await dispatchDueMetrics(db!)).toBeGreaterThanOrEqual(1);
        const jobs = await db!.select().from(schema.jobs).where(and(eq(schema.jobs.orgId, orgId), eq(schema.jobs.type, METRICS_JOB)));
        expect(jobs).toHaveLength(1);
        expect(jobs[0].payload).toEqual({ draftId: d.id });
      });

      // Collection is idempotent, so the guard that matters is against piling
      // up duplicate JOBS, not against collecting twice.
      it("does not queue a second job while one is still pending", async () => {
        await published();
        expect(await dispatchDueMetrics(db!)).toBe(1);
        expect(await dispatchDueMetrics(db!)).toBe(0);
      });

      it("skips a post already captured today", async () => {
        const d = await published();
        await forOrg(db!, orgId).recordPostMetrics(brandId, d.id, {
          platform: "x", externalPostId: "ext_1",
          impressions: 1, likes: 1, comments: null, shares: null, clicks: null,
          capturedOn: new Date().toISOString().slice(0, 10),
        });
        expect(await dispatchDueMetrics(db!)).toBe(0);
      });

      it("leaves unpublished, id-less, deleted and long-past posts alone", async () => {
        await newDraft({ status: "scheduled" });
        await published({ externalPostId: null });
        await published({ deletedAt: new Date() });
        // Engagement is settled long before the window closes; past it we would
        // be spending API calls on a flat line.
        await published({ publishedAt: new Date(Date.now() - 60 * 24 * 3600_000) });
        expect(await dispatchDueMetrics(db!)).toBe(0);
      });
    });

    describe("the collector", () => {
      it("stores what the platform reported", async () => {
        await forOrg(db!, orgId).saveConnection(brandId, "x", { accessToken: "tok", externalAccountId: "acct" });
        const d = await published();
        stubMetrics({ data: { public_metrics: { like_count: 14, reply_count: 3, retweet_count: 2, quote_count: 1, impression_count: 820 } } });

        const out = await collect(jobFor(d.id));
        expect(out).toMatchObject({ collected: true, likes: 14, comments: 3, shares: 3, impressions: 820 });

        const [row] = await metricsOf(d.id);
        expect(row.likes).toBe(14);
        expect(row.shares).toBe(3);
        expect(row.platform).toBe("x");
        expect(row.externalPostId).toBe("ext_1");
      });

      // Engagement moves fast in the first hours, so the later read of a day is
      // the better one — a refresh, not a duplicate.
      it("refreshes the same day's snapshot instead of duplicating it", async () => {
        await forOrg(db!, orgId).saveConnection(brandId, "x", { accessToken: "tok" });
        const d = await published();
        stubMetrics({ data: { public_metrics: { like_count: 5 } } });
        await collect(jobFor(d.id));
        stubMetrics({ data: { public_metrics: { like_count: 40 } } });
        await collect(jobFor(d.id));

        const rows = await metricsOf(d.id);
        expect(rows).toHaveLength(1);
        expect(rows[0].likes).toBe(40);
      });

      // A row of all-nulls would claim we measured this post and found nothing.
      it("writes no row when the platform returned nothing usable", async () => {
        await forOrg(db!, orgId).saveConnection(brandId, "x", { accessToken: "tok" });
        const d = await published();
        stubMetrics({ data: {} });
        expect(await collect(jobFor(d.id))).toMatchObject({ collected: false, reason: "no_metrics_available" });
        expect(await metricsOf(d.id)).toHaveLength(0);
      });

      // A missing scope is a platform approval to obtain, not a fault to back
      // off from — and the post itself is fine either way.
      it("reports a missing scope without failing the job", async () => {
        await forOrg(db!, orgId).saveConnection(brandId, "x", { accessToken: "tok" });
        const d = await published();
        stubMetrics({ error: { message: "insufficient scope" } }, 403);
        expect(await collect(jobFor(d.id))).toMatchObject({ collected: false, reason: "not_permitted:x" });
      });

      it("flags a revoked token for re-auth", async () => {
        await forOrg(db!, orgId).saveConnection(brandId, "x", { accessToken: "dead" });
        const d = await published();
        stubMetrics({}, 401);
        await collect(jobFor(d.id));
        expect((await forOrg(db!, orgId).getConnection(brandId, "x"))?.status).toBe("expired");
      });

      it("retries a rate limit", async () => {
        await forOrg(db!, orgId).saveConnection(brandId, "x", { accessToken: "tok" });
        const d = await published();
        stubMetrics({}, 429);
        await expect(collect(jobFor(d.id))).rejects.toMatchObject({ retryable: true });
      });

      // The account was disconnected after the post went out. The post is still
      // live; we simply can no longer read it.
      it("stops quietly when the account is no longer connected", async () => {
        const d = await published();
        let called = false;
        vi.stubGlobal("fetch", async () => { called = true; return new Response("{}"); });
        expect(await collect(jobFor(d.id))).toMatchObject({ collected: false, reason: "not_connected:x" });
        expect(called).toBe(false);
      });

      it("never collects for another workspace's post", async () => {
        const [other] = await db!.insert(schema.organizations).values({ name: "metrics-other" }).returning();
        const [ob] = await db!.insert(schema.brands).values({ orgId: other.id, name: "O" }).returning();
        const [od] = await db!.insert(schema.drafts).values({
          orgId: other.id, brandId: ob.id, platform: "X / Twitter", hook: "h", body: "b",
          status: "published", externalPostId: "theirs", publishedAt: new Date(),
        }).returning();

        expect(await collect(jobFor(od.id))).toMatchObject({ collected: false, reason: "draft_missing" });

        await db!.delete(schema.drafts).where(eq(schema.drafts.orgId, other.id));
        await db!.delete(schema.brands).where(eq(schema.brands.orgId, other.id));
        await db!.delete(schema.organizations).where(eq(schema.organizations.id, other.id));
      });
    });

    describe("measuredPosts", () => {
      // The timing findings are only worth showing if the hour is the brand's
      // own. Postgres owns the conversion because it owns the zone database —
      // and AT TIME ZONE is easy to apply in the wrong direction.
      it("reports the local hour and weekday in the brand's timezone", async () => {
        // 22:00 UTC on a Sunday is 01:00 MONDAY in Riyadh (+03).
        const d = await published({ publishedAt: new Date("2026-09-06T22:00:00Z") });
        await forOrg(db!, orgId).recordPostMetrics(brandId, d.id, {
          platform: "x", externalPostId: "ext_1", impressions: 10, likes: 1,
          comments: null, shares: null, clicks: null, capturedOn: "2026-09-07",
        });

        const [row] = (await forOrg(db!, orgId).measuredPosts(brandId)).filter((r) => r.draftId === d.id);
        expect(row.localHour).toBe(1);
        expect(row.localWeekday).toBe(1); // Monday, not Sunday
      });

      it("honours a brand that is in another zone", async () => {
        await db!.update(schema.brands).set({ timezone: "America/New_York" }).where(eq(schema.brands.id, brandId));
        const d = await published({ publishedAt: new Date("2026-09-06T22:00:00Z") });
        const [row] = (await forOrg(db!, orgId).measuredPosts(brandId)).filter((r) => r.draftId === d.id);
        expect(row.localHour).toBe(18); // 22:00 UTC is 18:00 EDT, same day
        expect(row.localWeekday).toBe(0);
        await db!.update(schema.brands).set({ timezone: "Asia/Riyadh" }).where(eq(schema.brands.id, brandId));
      });

      // A published post with no numbers must still be returned, so the report
      // can count it as unmeasured rather than pretend it does not exist.
      it("returns published posts that have no metrics yet", async () => {
        const d = await published();
        const rows = await forOrg(db!, orgId).measuredPosts(brandId);
        const row = rows.find((r) => r.draftId === d.id)!;
        expect(row).toBeTruthy();
        expect(row.likes).toBeNull();
      });

      it("uses the newest snapshot when there are several", async () => {
        const d = await published();
        const org = forOrg(db!, orgId);
        await org.recordPostMetrics(brandId, d.id, { platform: "x", externalPostId: "ext_1", impressions: null, likes: 1, comments: null, shares: null, clicks: null, capturedOn: "2026-09-01" });
        await org.recordPostMetrics(brandId, d.id, { platform: "x", externalPostId: "ext_1", impressions: null, likes: 99, comments: null, shares: null, clicks: null, capturedOn: "2026-09-05" });
        const row = (await org.measuredPosts(brandId)).find((r) => r.draftId === d.id)!;
        expect(row.likes).toBe(99);
      });

      it("never returns another workspace's posts", async () => {
        const [other] = await db!.insert(schema.organizations).values({ name: "perf-other" }).returning();
        const [ob] = await db!.insert(schema.brands).values({ orgId: other.id, name: "O" }).returning();
        await db!.insert(schema.drafts).values({
          orgId: other.id, brandId: ob.id, platform: "X / Twitter", hook: "theirs", body: "b",
          status: "published", externalPostId: "theirs", publishedAt: new Date(),
        });

        const rows = await forOrg(db!, orgId).measuredPosts(brandId);
        expect(rows.some((r) => r.hook === "theirs")).toBe(false);

        await db!.delete(schema.drafts).where(eq(schema.drafts.orgId, other.id));
        await db!.delete(schema.brands).where(eq(schema.brands.orgId, other.id));
        await db!.delete(schema.organizations).where(eq(schema.organizations.id, other.id));
      });
    });

    describe("latestPostMetrics", () => {
      it("returns the newest snapshot per post, joined to the post", async () => {
        const d = await published({ hook: "عنوان البوست" });
        const org = forOrg(db!, orgId);
        await org.recordPostMetrics(brandId, d.id, {
          platform: "x", externalPostId: "ext_1", impressions: 100, likes: 2,
          comments: null, shares: null, clicks: null, capturedOn: "2026-09-01",
        });
        await org.recordPostMetrics(brandId, d.id, {
          platform: "x", externalPostId: "ext_1", impressions: 900, likes: 30,
          comments: null, shares: null, clicks: null, capturedOn: "2026-09-02",
        });

        const rows = await org.latestPostMetrics(brandId);
        expect(rows).toHaveLength(1);
        expect(rows[0].likes).toBe(30); // the later capture wins
        expect(rows[0].hook).toBe("عنوان البوست");
      });
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
