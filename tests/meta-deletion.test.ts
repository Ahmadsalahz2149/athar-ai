import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { newConfirmationCode, parseSignedRequest, signRequest } from "@/lib/social/meta-signed-request";

/**
 * Meta's deletion and deauthorize callbacks (Phase 6).
 *
 * These endpoints are public, unauthenticated, and they DELETE. The signature
 * is the entire security model, so most of what follows is about refusing —
 * a forged payload, a tampered one, the wrong secret, an unexpected algorithm.
 * If any of those were accepted, anyone who could POST to the URL could wipe
 * another person's connections by guessing a numeric user id.
 */

const SECRET = "test-app-secret";

describe("signed_request verification", () => {
  it("accepts a genuine request and returns the user it names", () => {
    const signed = signRequest({ algorithm: "HMAC-SHA256", user_id: "12345", issued_at: 1758000000 }, SECRET);
    const r = parseSignedRequest(signed, SECRET);
    expect(r).toMatchObject({ ok: true, userId: "12345" });
  });

  // The attack this exists to stop: craft a payload naming someone else's id.
  it("refuses a payload signed with the wrong secret", () => {
    const signed = signRequest({ algorithm: "HMAC-SHA256", user_id: "victim" }, "not-our-secret");
    expect(parseSignedRequest(signed, SECRET)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("refuses a payload edited after signing", () => {
    const signed = signRequest({ algorithm: "HMAC-SHA256", user_id: "12345" }, SECRET);
    const [sig] = signed.split(".");
    const tampered = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "99999" })).toString("base64url");
    expect(parseSignedRequest(`${sig}.${tampered}`, SECRET)).toEqual({ ok: false, reason: "bad_signature" });
  });

  // Checked before the signature is compared, so an attacker cannot name an
  // algorithm we do not implement and have us verify with ours anyway.
  it("refuses an unexpected algorithm", () => {
    const signed = signRequest({ algorithm: "none", user_id: "12345" }, SECRET);
    expect(parseSignedRequest(signed, SECRET)).toEqual({ ok: false, reason: "bad_algorithm" });
  });

  it("refuses anything that is not a signed request at all", () => {
    for (const junk of ["", ".", "abc", "abc.", ".abc", "not base64!.x", "a.b.c"]) {
      expect(parseSignedRequest(junk, SECRET).ok).toBe(false);
    }
  });

  it("refuses a signature of the wrong length without throwing", () => {
    // timingSafeEqual throws on a length mismatch; a forged request must get a
    // clean refusal, not a 500.
    const encoded = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "1" })).toString("base64url");
    expect(parseSignedRequest(`${Buffer.from("short").toString("base64url")}.${encoded}`, SECRET)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("refuses a valid signature that names nobody", () => {
    expect(parseSignedRequest(signRequest({ algorithm: "HMAC-SHA256" }, SECRET), SECRET)).toEqual({ ok: false, reason: "no_user" });
  });

  // With no secret configured we cannot verify anything, so we must not pretend
  // to — the route answers 503 rather than deleting on an unverified request.
  it("refuses everything when no app secret is configured", () => {
    expect(parseSignedRequest(signRequest({ algorithm: "HMAC-SHA256", user_id: "1" }, SECRET), "")).toEqual({ ok: false, reason: "no_secret" });
  });
});

describe("confirmation codes", () => {
  it("avoids the characters people mistype when reading one aloud", () => {
    const codes = Array.from({ length: 200 }, () => newConfirmationCode());
    for (const c of codes) expect(c).toMatch(/^[23456789BCDFGHJKMNPQRSTVWXYZ]{12}$/);
    expect(new Set(codes).size).toBe(200);
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
if (DATABASE_URL) process.env.DATABASE_URL = DATABASE_URL;

const sql = DATABASE_URL ? postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 2 }) : null;
const db = sql ? drizzle(sql, { schema }) : null;

let deleteMetaUserData: typeof import("@/lib/social/metaDeletion").deleteMetaUserData;
let deauthorizeMetaUser: typeof import("@/lib/social/metaDeletion").deauthorizeMetaUser;
let deletionStatus: typeof import("@/lib/social/metaDeletion").deletionStatus;

const META_USER = "meta-user-1";
const OTHER_USER = "meta-user-2";
let orgId = "";
let brandId = "";
// A second workspace entirely: only one connection per brand+platform is
// allowed, and "somebody else, somewhere else" is the realistic shape of the
// row a deletion must not touch.
let otherOrgId = "";
let otherBrandId = "";

async function connection(platform: string, externalUserId: string | null, where = { orgId, brandId }) {
  await db!.insert(schema.socialConnections).values({
    orgId: where.orgId, brandId: where.brandId, platform,
    accessToken: `token-${platform}-${externalUserId}`,
    externalAccountId: `acct-${platform}`,
    externalUserId,
    status: "connected",
  });
}
const otherWorkspace = () => ({ orgId: otherOrgId, brandId: otherBrandId });

describe.runIf(!!db)("honouring a deletion request", () => {
  beforeAll(async () => {
    ({ deleteMetaUserData, deauthorizeMetaUser, deletionStatus } = await import("@/lib/social/metaDeletion"));
    const [o] = await db!.insert(schema.organizations).values({ name: "meta-del" }).returning();
    orgId = o.id;
    const [b] = await db!.insert(schema.brands).values({ orgId, name: "brand" }).returning();
    brandId = b.id;

    const [o2] = await db!.insert(schema.organizations).values({ name: "meta-del-other" }).returning();
    otherOrgId = o2.id;
    const [b2] = await db!.insert(schema.brands).values({ orgId: otherOrgId, name: "other-brand" }).returning();
    otherBrandId = b2.id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(schema.dataDeletionRequests).where(eq(schema.dataDeletionRequests.externalUserId, META_USER));
    await db.delete(schema.dataDeletionRequests).where(eq(schema.dataDeletionRequests.externalUserId, OTHER_USER));
    for (const id of [orgId, otherOrgId].filter(Boolean)) {
      await db.delete(schema.socialConnections).where(eq(schema.socialConnections.orgId, id));
      await db.delete(schema.drafts).where(eq(schema.drafts.orgId, id));
      await db.delete(schema.creditLedger).where(eq(schema.creditLedger.orgId, id));
      await db.delete(schema.brands).where(eq(schema.brands.orgId, id));
      await db.delete(schema.organizations).where(eq(schema.organizations.id, id));
    }
    await sql!.end({ timeout: 3 });
  });

  it("removes that person's Meta connections and nobody else's", async () => {
    await connection("facebook", META_USER);
    await connection("instagram", META_USER);
    await connection("facebook", OTHER_USER, otherWorkspace());

    const { deleted, confirmationCode } = await deleteMetaUserData(META_USER);
    expect(deleted).toBe(2);
    expect(confirmationCode).toHaveLength(12);

    const left = await db!.select().from(schema.socialConnections);
    expect(left.map((c) => c.externalUserId)).toEqual([OTHER_USER]);
  });

  // A Meta user id must never match a LinkedIn or X row, however unlikely the
  // collision: those are different platforms and a different consent.
  it("does not touch connections on other platforms", async () => {
    await db!.delete(schema.socialConnections).where(eq(schema.socialConnections.orgId, orgId));
    await connection("linkedin", META_USER);
    await connection("x", META_USER);

    expect((await deleteMetaUserData(META_USER)).deleted).toBe(0);
    expect(await db!.select().from(schema.socialConnections).where(eq(schema.socialConnections.orgId, orgId))).toHaveLength(2);
  });

  // The customer's own work is not the platform's to ask about. Erasing it
  // because someone unlinked a Facebook account would be its own data loss.
  it("leaves the workspace's content alone", async () => {
    await db!.insert(schema.drafts).values({ orgId, brandId, platform: "facebook", hook: "the customer's post", body: "b", status: "draft" });
    await connection("facebook", META_USER);

    await deleteMetaUserData(META_USER);

    const drafts = await db!.select().from(schema.drafts).where(eq(schema.drafts.orgId, orgId));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].hook).toBe("the customer's post");
  });

  // A platform retrying a webhook must not get an error the second time.
  it("is idempotent, and still answers with a code", async () => {
    const again = await deleteMetaUserData(META_USER);
    expect(again.deleted).toBe(0);
    expect(again.confirmationCode).toHaveLength(12);
  });

  it("can be checked with the code, and reveals nothing without one", async () => {
    await connection("facebook", META_USER);
    const { confirmationCode, deleted } = await deleteMetaUserData(META_USER);

    const found = await deletionStatus(confirmationCode);
    expect(found).toMatchObject({ found: true, status: "completed", deleted });

    expect(await deletionStatus(newConfirmationCode())).toEqual({ found: false });
    expect(await deletionStatus("")).toEqual({ found: false });
  });

  // Removing the app is a withdrawal of consent: keep no token behind.
  it("drops every Meta connection when the app is removed", async () => {
    await db!.delete(schema.socialConnections);
    await connection("facebook", META_USER);
    await connection("instagram", META_USER);
    await connection("facebook", OTHER_USER, otherWorkspace());

    expect(await deauthorizeMetaUser(META_USER)).toBe(2);
    const left = await db!.select().from(schema.socialConnections);
    expect(left.map((c) => c.externalUserId)).toEqual([OTHER_USER]);
  });

  // Connections made before Phase 6 have no user id. They must never be swept
  // up by someone else's deletion request.
  it("never matches a connection that has no user id recorded", async () => {
    await db!.delete(schema.socialConnections).where(eq(schema.socialConnections.orgId, orgId));
    await connection("facebook", null);

    expect((await deleteMetaUserData(META_USER)).deleted).toBe(0);
    expect(await deauthorizeMetaUser(META_USER)).toBe(0);
    expect(await db!.select().from(schema.socialConnections).where(eq(schema.socialConnections.orgId, orgId))).toHaveLength(1);
  });
});

describe("the signature is what the route trusts", () => {
  // A cross-check that the helper and a hand-rolled signature agree — if these
  // ever diverge, every real callback from Meta would be rejected.
  it("matches an independently computed HMAC over the encoded payload", () => {
    const payload = { algorithm: "HMAC-SHA256", user_id: "777" };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
    expect(parseSignedRequest(`${sig}.${encoded}`, SECRET)).toMatchObject({ ok: true, userId: "777" });
  });
});
