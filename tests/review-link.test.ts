import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql as raw } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";
import { hashToken, newToken } from "@/lib/tokens";

/**
 * The client review link (Phase 4).
 *
 * This is the only surface in the product where a person with no account can
 * both read a workspace's content and write to it. So most of these tests are
 * about the boundary: what the token CANNOT reach, and what it cannot do to
 * what it can reach. A review link that quietly widens into account access is
 * how an agency loses a client.
 */

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
// publicReview uses the app's db singleton, which reads DATABASE_URL at import
// time — hence the dynamic import in beforeAll.
if (DATABASE_URL) process.env.DATABASE_URL = DATABASE_URL;

const sql = DATABASE_URL ? postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 2 }) : null;
const db = sql ? drizzle(sql, { schema }) : null;

let reviewBoard: typeof import("@/lib/review/publicReview").reviewBoard;
let recordReviewDecision: typeof import("@/lib/review/publicReview").recordReviewDecision;

let orgId = "";
let brandId = "";
let otherBrandId = "";
let otherOrgId = "";
let token = "";
let pendingId = "";
let hiddenDraftId = "";
let otherBrandDraftId = "";

async function addDraft(org: string, brand: string, hook: string, status: string) {
  const [d] = await db!.insert(schema.drafts).values({ orgId: org, brandId: brand, platform: "linkedin", hook, body: "نص البوست", status }).returning();
  return d.id;
}

async function makeLink(brand: string, label: string | null, opts: { expiresAt?: Date | null } = {}) {
  const t = newToken();
  await forOrg(db!, orgId).createReviewLink(brand, {
    label,
    tokenHash: hashToken(t),
    createdBy: null,
    expiresAt: opts.expiresAt === undefined ? new Date(Date.now() + 86_400_000) : opts.expiresAt,
  });
  return t;
}

describe.runIf(!!db)("client review link", () => {
  beforeAll(async () => {
    ({ reviewBoard, recordReviewDecision } = await import("@/lib/review/publicReview"));

    const [o] = await db!.insert(schema.organizations).values({ name: "review-agency" }).returning();
    orgId = o.id;
    const [b] = await db!.insert(schema.brands).values({ orgId, name: "عميل المراجعة" }).returning();
    brandId = b.id;
    const [b2] = await db!.insert(schema.brands).values({ orgId, name: "another client" }).returning();
    otherBrandId = b2.id;
    const [o2] = await db!.insert(schema.organizations).values({ name: "review-other-org" }).returning();
    otherOrgId = o2.id;

    pendingId = await addDraft(orgId, brandId, "بوست بانتظار الموافقة", "pending");
    await addDraft(orgId, brandId, "بوست موافَق عليه", "approved");
    // Must NOT be shown: work in progress, and a decision already taken.
    hiddenDraftId = await addDraft(orgId, brandId, "مسودّة لم تُعرض بعد", "draft");
    await addDraft(orgId, brandId, "بوست مرفوض", "rejected");
    otherBrandDraftId = await addDraft(orgId, otherBrandId, "بوست عميل آخر", "pending");

    // Outside the window: a review link is about the current cycle.
    const oldId = await addDraft(orgId, brandId, "بوست قديم", "pending");
    await db!.update(schema.drafts).set({ createdAt: raw`now() - interval '200 days'` }).where(eq(schema.drafts.id, oldId));

    token = await makeLink(brandId, "أركان");
  });

  afterAll(async () => {
    if (!db) return;
    for (const id of [orgId, otherOrgId].filter(Boolean)) {
      await db.delete(schema.reviewLinks).where(eq(schema.reviewLinks.orgId, id));
      await db.delete(schema.drafts).where(eq(schema.drafts.orgId, id));
      await db.delete(schema.creditLedger).where(eq(schema.creditLedger.orgId, id));
      await db.delete(schema.brands).where(eq(schema.brands.orgId, id));
      await db.delete(schema.organizations).where(eq(schema.organizations.id, id));
    }
    await sql!.end({ timeout: 3 });
  });

  it("shows the brand and the posts that are actually up for review", async () => {
    const res = await reviewBoard(token);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.board.brandName).toBe("عميل المراجعة");
    expect(res.board.label).toBe("أركان");

    const hooks = res.board.posts.map((p) => p.hook);
    expect(hooks).toContain("بوست بانتظار الموافقة");
    expect(hooks).toContain("بوست موافَق عليه");
  });

  // A client seeing a half-written draft, or a post the agency already decided
  // against, is the agency's judgement being shown without their consent.
  it("hides work in progress, decisions already taken, and old cycles", async () => {
    const res = await reviewBoard(token);
    if (!res.ok) throw new Error("expected a board");
    const hooks = res.board.posts.map((p) => p.hook);
    expect(hooks).not.toContain("مسودّة لم تُعرض بعد");
    expect(hooks).not.toContain("بوست مرفوض");
    expect(hooks).not.toContain("بوست قديم");
  });

  it("shows one brand only, never the workspace", async () => {
    const res = await reviewBoard(token);
    if (!res.ok) throw new Error("expected a board");
    expect(res.board.posts.map((p) => p.hook)).not.toContain("بوست عميل آخر");
  });

  it("records an approval and attributes a change request to the link", async () => {
    expect(await recordReviewDecision(token, pendingId, "approved")).toEqual({ ok: true });
    let row = (await db!.select().from(schema.drafts).where(eq(schema.drafts.id, pendingId)))[0];
    expect(row.status).toBe("approved");

    expect(await recordReviewDecision(token, pendingId, "needs_edit", "  الهوك   طويل جدًا ")).toEqual({ ok: true });
    row = (await db!.select().from(schema.drafts).where(eq(schema.drafts.id, pendingId)))[0];
    expect(row.status).toBe("needs_edit");
    // The label rides along so the agency reading Approvals knows it is the
    // client speaking, not a teammate. Whitespace is collapsed.
    expect(row.reviewNote).toBe("أركان: الهوك طويل جدًا");
  });

  // The token grants "say yes or say what to change". Anything else — publish,
  // schedule, reject, edit the text — is the agency's call.
  it("writes only the two statuses a client is allowed to set", async () => {
    // @ts-expect-error deliberately calling it the way a hand-written request would
    expect(await recordReviewDecision(token, pendingId, "published")).toEqual({ ok: false, reason: "bad_decision" });
    // @ts-expect-error same
    expect(await recordReviewDecision(token, pendingId, "scheduled")).toEqual({ ok: false, reason: "bad_decision" });
    const row = (await db!.select().from(schema.drafts).where(eq(schema.drafts.id, pendingId)))[0];
    expect(row.status).toBe("needs_edit"); // unchanged by either attempt
  });

  it("cannot touch a post outside the brand it was issued for", async () => {
    expect(await recordReviewDecision(token, otherBrandDraftId, "approved")).toEqual({ ok: false, reason: "not_found" });
    const row = (await db!.select().from(schema.drafts).where(eq(schema.drafts.id, otherBrandDraftId)))[0];
    expect(row.status).toBe("pending");
  });

  it("cannot touch a post that is not up for review", async () => {
    expect(await recordReviewDecision(token, hiddenDraftId, "approved")).toEqual({ ok: false, reason: "not_found" });
    const row = (await db!.select().from(schema.drafts).where(eq(schema.drafts.id, hiddenDraftId)))[0];
    expect(row.status).toBe("draft");
  });

  it("refuses a revoked link, for reading and for writing", async () => {
    const t = await makeLink(brandId, "منسحب");
    const link = (await forOrg(db!, orgId).listReviewLinks(brandId)).find((l) => l.label === "منسحب")!;
    expect(await forOrg(db!, orgId).revokeReviewLink(brandId, link.id)).toBe(true);

    expect(await reviewBoard(t)).toEqual({ ok: false, reason: "revoked" });
    expect(await recordReviewDecision(t, pendingId, "approved")).toEqual({ ok: false, reason: "revoked" });
  });

  it("refuses an expired link", async () => {
    const t = await makeLink(brandId, "منتهٍ", { expiresAt: new Date(Date.now() - 60_000) });
    expect(await reviewBoard(t)).toEqual({ ok: false, reason: "expired" });
    expect(await recordReviewDecision(t, pendingId, "approved")).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses a token that matches nothing", async () => {
    expect(await reviewBoard(newToken())).toEqual({ ok: false, reason: "invalid" });
    expect(await reviewBoard("")).toEqual({ ok: false, reason: "invalid" });
    expect(await recordReviewDecision(newToken(), pendingId, "approved")).toEqual({ ok: false, reason: "invalid" });
  });

  it("will not let another workspace revoke this one's link", async () => {
    const label = "target-link";
    await makeLink(brandId, label);
    const link = (await forOrg(db!, orgId).listReviewLinks(brandId)).find((l) => l.label === label)!;
    expect(await forOrg(db!, otherOrgId).revokeReviewLink(brandId, link.id)).toBe(false);
  });

  it("never hands the token hash to the screen that lists links", async () => {
    const rows = await forOrg(db!, orgId).listReviewLinks(brandId);
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0])).not.toContain("tokenHash");
  });

  it("records that the link was opened, so the agency knows it arrived", async () => {
    const before = (await forOrg(db!, orgId).listReviewLinks(brandId)).find((l) => l.label === "أركان")!;
    expect(before.lastUsedAt).not.toBeNull(); // the reads above already touched it
  });
});
