import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";
import { eraseOrgData, ORG_SCOPED_TABLES } from "@/lib/gdpr/erase";
import { buildExport } from "@/lib/gdpr/export";

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
const sqlc = DATABASE_URL ? postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 3 }) : null;
const db = sqlc ? drizzle(sqlc, { schema }) : null;

let orgA = "", orgB = "", brandA = "", brandB = "";

describe.runIf(!!db)("GDPR erasure", () => {
  beforeAll(async () => {
    const [a] = await db!.insert(schema.organizations).values({ name: "gdpr-A" }).returning();
    const [b] = await db!.insert(schema.organizations).values({ name: "gdpr-B" }).returning();
    orgA = a.id; orgB = b.id;
    const [ba] = await db!.insert(schema.brands).values({ orgId: orgA, name: "A" }).returning();
    const [bb] = await db!.insert(schema.brands).values({ orgId: orgB, name: "B" }).returning();
    brandA = ba.id; brandB = bb.id;
  });

  afterAll(async () => {
    if (!db) return;
    for (const id of [orgA, orgB]) if (id) await eraseOrgData(db, id).catch(() => {});
    await sqlc!.end({ timeout: 3 });
  });

  // The real safety net: if someone adds a table with an org_id and forgets to
  // list it, erasure would silently leave personal data behind forever.
  it("covers EVERY org-scoped table in the live schema", async () => {
    const rows = await sqlc!`
      select c.table_name from information_schema.columns c
      join information_schema.tables t
        on t.table_name = c.table_name and t.table_schema = c.table_schema
      where c.table_schema = 'public' and c.column_name = 'org_id' and t.table_type = 'BASE TABLE'
    `;
    const inSchema = new Set(rows.map((r) => r.table_name as string));
    const listed = new Set<string>(ORG_SCOPED_TABLES);
    const missing = [...inSchema].filter((t) => !listed.has(t));
    const stale = [...listed].filter((t) => !inSchema.has(t));
    expect(missing, `tables with org_id not covered by erasure: ${missing.join(", ")}`).toEqual([]);
    expect(stale, `listed for erasure but no longer in the schema: ${stale.join(", ")}`).toEqual([]);
  });

  // Security: the export is a file a person downloads and may forward. OAuth
  // tokens are credentials for their *other* accounts and must never ride along.
  it("exports the workspace but redacts OAuth tokens", async () => {
    const t = forOrg(db!, orgB);
    await t.saveConnection(brandB, "facebook", {
      accessToken: "SUPER_SECRET_ACCESS",
      refreshToken: "SUPER_SECRET_REFRESH",
      accountName: "Page",
    });

    const doc = await buildExport(db!, orgB, { id: "u-1", email: "b@example.com" });
    const json = JSON.stringify(doc);

    expect(json).not.toContain("SUPER_SECRET_ACCESS");
    expect(json).not.toContain("SUPER_SECRET_REFRESH");
    // The connection itself is still reported — redaction, not omission.
    const conns = doc.data.social_connections as Record<string, unknown>[];
    expect(conns.length).toBe(1);
    expect(conns[0].platform).toBe("facebook");
    expect(conns[0].access_token).toBe("[redacted]");
    // And the user's real content is present.
    expect((doc.data.brands as unknown[]).length).toBeGreaterThan(0);
    expect(doc.account.email).toBe("b@example.com");
  });

  it("erases the workspace completely and leaves other tenants untouched", async () => {
    const t = forOrg(db!, orgA);
    // Seed a representative row in each layer, including children behind FKs.
    await t.grant(100, "signup_grant");
    const srcA = await t.saveSource(brandA, { kind: "text", title: "s", status: "ready" });
    await db!.insert(schema.sourceChunks).values({
      orgId: orgA, brandId: brandA, sourceId: srcA, idx: 0, content: "chunk",
      embedding: Array.from({ length: 1024 }, () => 0.01),
    });
    await t.saveDraft(brandA, { platform: "x", topic: "t", hook: "h", body: "b" });
    await t.saveIdeas(brandA, [{ title: "i", angle: "a", category: "x" }]);
    await db!.insert(schema.memberships).values({ orgId: orgA, userId: crypto.randomUUID(), role: "owner" });

    // Same shape for the control tenant — it must survive intact.
    const tB = forOrg(db!, orgB);
    await tB.grant(50, "signup_grant");
    await tB.saveDraft(brandB, { platform: "x", topic: "t", hook: "h", body: "b" });

    const deleted = await eraseOrgData(db!, orgA);
    expect(deleted.organizations).toBe(1);
    expect(deleted.brands).toBeGreaterThan(0);
    expect(deleted.credit_ledger).toBeGreaterThan(0);

    // Nothing at all may remain for A, in ANY org-scoped table.
    for (const table of ORG_SCOPED_TABLES) {
      const [{ n }] = await sqlc!.unsafe(`select count(*)::int as n from "${table}" where org_id = $1`, [orgA]);
      expect(n, `${table} still holds rows for the erased workspace`).toBe(0);
    }
    const [{ n: orgs }] = await sqlc!`select count(*)::int as n from organizations where id = ${orgA}`;
    expect(orgs).toBe(0);

    // The other tenant is entirely unaffected.
    expect(await tB.balance()).toBe(50);
    const [{ n: bRows }] = await sqlc!`select count(*)::int as n from drafts where org_id = ${orgB}`;
    expect(bRows).toBe(1);
  });
});

it.runIf(!db)("skipped gdpr: no DATABASE_URL", () => {
  expect(true).toBe(true);
});
