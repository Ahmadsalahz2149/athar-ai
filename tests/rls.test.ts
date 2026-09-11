import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";
import { asSystem } from "@/lib/db/rls";

/**
 * Row-level security (ADR-011), proved against a real restricted role.
 *
 * The rest of the suite connects as the owner, which Postgres exempts from its
 * own policies — so it can say nothing about whether the policies work. These
 * tests open a SECOND connection as the unprivileged role the app will use in
 * production, and check the thing that actually matters: that a query which
 * forgets to scope itself returns nothing rather than another tenant's rows.
 *
 * Requires migration 0025 plus a local password on the role; skipped otherwise
 * so a fresh checkout does not fail on a missing role.
 */
function ownerUrl(): string | null {
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

/** The same database, reached as the unprivileged role. */
function restrictedUrl(owner: string | null): string | null {
  if (process.env.DATABASE_URL_RLS) return process.env.DATABASE_URL_RLS;
  if (!owner) return null;
  try {
    const u = new URL(owner);
    u.username = "athar_app";
    u.password = "localtest";
    return u.toString();
  } catch {
    return null;
  }
}

const OWNER_URL = ownerUrl();
const RLS_URL = restrictedUrl(OWNER_URL);
const opts = { ssl: { rejectUnauthorized: false }, prepare: false, max: 3 } as const;

const ownerSql = OWNER_URL ? postgres(OWNER_URL, opts) : null;
const ownerDb = ownerSql ? drizzle(ownerSql, { schema }) : null;
const rlsSql = RLS_URL ? postgres(RLS_URL, opts) : null;
const rlsDb = rlsSql ? drizzle(rlsSql, { schema }) : null;

let ready = false;
let orgA = "";
let orgB = "";
let brandA = "";
let brandB = "";

describe.runIf(!!ownerDb && !!rlsDb)("row-level security", () => {
  beforeAll(async () => {
    // Can the restricted role connect at all, and are the policies applied?
    try {
      await rlsSql!`select 1`;
      const [{ n }] = await ownerSql!<{ n: number }[]>`
        select count(*)::int as n from pg_policies where schemaname = 'public' and policyname = 'drafts_tenant'`;
      ready = n > 0;
    } catch {
      ready = false;
    }
    if (!ready) return;

    // Setup runs as the OWNER — bypassing RLS is exactly how a migration or an
    // operator works, and it is what lets us plant a second tenant's rows.
    const [a] = await ownerDb!.insert(schema.organizations).values({ name: "rls-a" }).returning();
    const [b] = await ownerDb!.insert(schema.organizations).values({ name: "rls-b" }).returning();
    orgA = a.id;
    orgB = b.id;
    const [ba] = await ownerDb!.insert(schema.brands).values({ orgId: orgA, name: "A" }).returning();
    const [bb] = await ownerDb!.insert(schema.brands).values({ orgId: orgB, name: "B" }).returning();
    brandA = ba.id;
    brandB = bb.id;
    for (const [org, brand, hook] of [[orgA, brandA, "secret-A"], [orgB, brandB, "secret-B"]] as const) {
      await ownerDb!.insert(schema.drafts).values({ orgId: org, brandId: brand, platform: "LinkedIn", hook, body: "b", status: "draft" });
    }
  });

  afterAll(async () => {
    if (ownerDb && orgA) {
      for (const id of [orgA, orgB]) {
        await ownerDb.delete(schema.drafts).where(eq(schema.drafts.orgId, id));
        await ownerDb.delete(schema.creditLedger).where(eq(schema.creditLedger.orgId, id));
        await ownerDb.delete(schema.brands).where(eq(schema.brands.orgId, id));
        await ownerDb.delete(schema.organizations).where(eq(schema.organizations.id, id));
      }
    }
    await ownerSql?.end({ timeout: 3 });
    await rlsSql?.end({ timeout: 3 });
  });

  /** One transaction as the restricted role, with the given settings applied. */
  async function asRole<T>(settings: Record<string, string>, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
    return rlsSql!.begin(async (tx) => {
      for (const [k, v] of Object.entries(settings)) await tx`select set_config(${k}, ${v}, true)`;
      return fn(tx as unknown as postgres.TransactionSql);
    }) as Promise<T>;
  }

  // The whole point: an unscoped query is not a leak, it is an empty result.
  it("shows NOTHING when no scope is set", async () => {
    if (!ready) return;
    const rows = await asRole({}, (tx) => tx`select id from drafts`);
    expect(rows.length).toBe(0);
  });

  it("shows only the scoped workspace's rows", async () => {
    if (!ready) return;
    const rows = await asRole({ "app.org_id": orgA }, (tx) => tx`select hook, org_id from drafts`);
    expect(rows.map((r) => r.hook)).toEqual(["secret-A"]);
    expect(rows.every((r) => r.org_id === orgA)).toBe(true);
  });

  // A query that deliberately asks for the other tenant still gets nothing:
  // the policy is applied by the database, not by the query's own WHERE clause.
  it("cannot reach another workspace even by asking for it directly", async () => {
    if (!ready) return;
    const rows = await asRole({ "app.org_id": orgA }, (tx) => tx`select hook from drafts where org_id = ${orgB}::uuid`);
    expect(rows.length).toBe(0);
    const orgs = await asRole({ "app.org_id": orgA }, (tx) => tx`select id from organizations`);
    expect(orgs.map((r) => r.id)).toEqual([orgA]);
  });

  it("refuses to WRITE a row into another workspace", async () => {
    if (!ready) return;
    await expect(
      asRole({ "app.org_id": orgA }, (tx) => tx`
        insert into drafts (org_id, brand_id, platform, hook, body, status)
        values (${orgB}::uuid, ${brandB}::uuid, 'X', 'smuggled', 'b', 'draft')`),
    ).rejects.toThrow(/row-level security/i);
    // And nothing landed.
    const check = await ownerSql!`select count(*)::int as n from drafts where hook = 'smuggled'`;
    expect(check[0].n).toBe(0);
  });

  it("refuses to MOVE a row into another workspace", async () => {
    if (!ready) return;
    // The rewritten row fails the policy's WITH CHECK, so Postgres raises
    // rather than re-homing a draft under another tenant.
    await expect(
      asRole({ "app.org_id": orgA }, (tx) => tx`update drafts set org_id = ${orgB}::uuid returning id`),
    ).rejects.toThrow(/row-level security/i);
    const still = await ownerSql!`select org_id from drafts where hook = 'secret-A'`;
    expect(still[0].org_id).toBe(orgA);
  });

  it("lets the explicit system scope cross workspaces — and only that", async () => {
    if (!ready) return;
    const all = await asRole({ "app.system": "on" }, (tx) => tx`select hook from drafts where hook like 'secret-%'`);
    expect(all.map((r) => r.hook).sort()).toEqual(["secret-A", "secret-B"]);
  });

  // Proof that applying the migration to production changes nothing today.
  it("leaves the owning role unaffected, which is why this is safe to ship", async () => {
    if (!ready) return;
    const rows = await ownerSql!`select hook from drafts where hook like 'secret-%'`;
    expect(rows.length).toBe(2);
  });

  // The façade end of the contract: forOrg must set the scope itself.
  describe("through forOrg on the restricted connection", () => {
    it("reads its own workspace and nothing else", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      try {
        const a = await forOrg(rlsDb!, orgA).listDrafts(brandA);
        expect(a.map((d) => d.hook)).toEqual(["secret-A"]);
        // Asking org A's façade for org B's brand returns nothing — the façade
        // scopes, and the database agrees.
        expect(await forOrg(rlsDb!, orgA).listDrafts(brandB)).toEqual([]);
        expect((await forOrg(rlsDb!, orgB).listDrafts(brandB)).map((d) => d.hook)).toEqual(["secret-B"]);
      } finally {
        delete process.env.DB_RLS;
      }
    });

    it("still runs the credit ledger's advisory-lock transaction under RLS", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      try {
        const org = forOrg(rlsDb!, orgA);
        // appendLedger opens its own transaction; under RLS that becomes a
        // savepoint inside the scoped one. If nesting were broken, this throws.
        await org.grant(100, "rls_test_grant");
        expect(await org.balance()).toBe(100);
      } finally {
        delete process.env.DB_RLS;
      }
    });

    it("runs cross-org helpers through asSystem on the restricted connection", async () => {
      if (!ready) return;
      process.env.DB_RLS = "true";
      try {
        const rows = await asSystem(rlsDb!, (tx) =>
          tx.execute(sql`select count(*)::int as n from drafts where hook like 'secret-%'`),
        );
        expect((rows as unknown as { n: number }[])[0].n).toBe(2);
      } finally {
        delete process.env.DB_RLS;
      }
    });
  });
});

it.runIf(!ownerSql || !rlsSql)("skipped RLS: no database or no restricted role", () => {
  expect(true).toBe(true);
});
