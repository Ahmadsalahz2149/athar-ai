import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";
import { orgIdForStripeCustomer } from "@/lib/payments/lookup";
import type { InvoiceRecord } from "@/lib/payments/tax";

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
const sql = DATABASE_URL ? postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 3 }) : null;
const db = sql ? drizzle(sql, { schema }) : null;

let orgA = "";
let orgB = "";

const record = (over: Partial<InvoiceRecord> = {}): InvoiceRecord => ({
  stripeInvoiceId: "in_test_1",
  number: "ATH-0001",
  status: "open",
  currency: "usd",
  subtotalCents: 9900,
  taxCents: 1485,
  totalCents: 11385,
  amountPaidCents: 0,
  taxRateBps: 1500,
  customerName: "Athar Co",
  customerCountry: "SA",
  customerTaxId: "310000000000003",
  hostedInvoiceUrl: "https://invoice.stripe.com/i/1",
  invoicePdfUrl: "https://invoice.stripe.com/i/1.pdf",
  periodStart: new Date("2026-01-01T00:00:00Z"),
  periodEnd: new Date("2026-02-01T00:00:00Z"),
  issuedAt: new Date("2026-01-01T10:00:00Z"),
  ...over,
});

describe.runIf(!!db)("invoice records", () => {
  beforeAll(async () => {
    const [a] = await db!.insert(schema.organizations).values({ name: "inv-a" }).returning();
    const [b] = await db!.insert(schema.organizations).values({ name: "inv-b" }).returning();
    orgA = a.id;
    orgB = b.id;
  });

  beforeEach(async () => {
    for (const id of [orgA, orgB]) await db!.delete(schema.invoices).where(eq(schema.invoices.orgId, id));
  });

  afterAll(async () => {
    if (!db) return;
    for (const id of [orgA, orgB]) {
      await db.delete(schema.invoices).where(eq(schema.invoices.orgId, id));
      await db.delete(schema.organizations).where(eq(schema.organizations.id, id));
    }
    await sql!.end({ timeout: 3 });
  });

  // Stripe delivers at least once, so the same invoice WILL arrive twice.
  it("records a replayed webhook onto one row, not two", async () => {
    const org = forOrg(db!, orgA);
    await org.recordInvoice(record());
    await org.recordInvoice(record());
    const rows = await org.listInvoices();
    expect(rows).toHaveLength(1);
  });

  // open → paid is the normal life of an invoice; the row has to follow it.
  it("updates the row as the invoice is finalized and then paid", async () => {
    const org = forOrg(db!, orgA);
    await org.recordInvoice(record({ status: "open", amountPaidCents: 0, number: null }));
    await org.recordInvoice(record({ status: "paid", amountPaidCents: 11385, number: "ATH-0007" }));
    const [row] = await org.listInvoices();
    expect(row.status).toBe("paid");
    expect(row.amountPaidCents).toBe(11385);
    expect(row.number).toBe("ATH-0007");
  });

  it("stores the VAT breakdown exactly, in integer cents and basis points", async () => {
    const org = forOrg(db!, orgA);
    await org.recordInvoice(record());
    const [row] = await org.listInvoices();
    expect(row.subtotalCents).toBe(9900);
    expect(row.taxCents).toBe(1485);
    expect(row.totalCents).toBe(11385);
    expect(row.taxRateBps).toBe(1500);
    expect(row.subtotalCents + row.taxCents).toBe(row.totalCents);
  });

  it("keeps one workspace's invoices out of another's", async () => {
    await forOrg(db!, orgA).recordInvoice(record({ stripeInvoiceId: "in_a" }));
    await forOrg(db!, orgB).recordInvoice(record({ stripeInvoiceId: "in_b" }));
    expect((await forOrg(db!, orgA).listInvoices()).map((r) => r.stripeInvoiceId)).toEqual(["in_a"]);
    expect((await forOrg(db!, orgB).listInvoices()).map((r) => r.stripeInvoiceId)).toEqual(["in_b"]);
  });

  // A Stripe invoice id is globally unique, so a replay aimed at the wrong org
  // must not be able to walk an invoice across the tenant boundary.
  it("never lets a replay move an invoice to another workspace", async () => {
    await forOrg(db!, orgA).recordInvoice(record({ stripeInvoiceId: "in_shared", customerName: "A" }));
    await forOrg(db!, orgB).recordInvoice(record({ stripeInvoiceId: "in_shared", customerName: "B" }));

    const a = await forOrg(db!, orgA).listInvoices();
    const b = await forOrg(db!, orgB).listInvoices();
    expect(a).toHaveLength(1);
    expect(a[0].customerName).toBe("A"); // untouched by org B's write
    expect(b).toHaveLength(0);
  });

  it("lists newest first", async () => {
    const org = forOrg(db!, orgA);
    await org.recordInvoice(record({ stripeInvoiceId: "in_old", issuedAt: new Date("2026-01-01T00:00:00Z") }));
    await org.recordInvoice(record({ stripeInvoiceId: "in_new", issuedAt: new Date("2026-03-01T00:00:00Z") }));
    expect((await org.listInvoices()).map((r) => r.stripeInvoiceId)).toEqual(["in_new", "in_old"]);
  });

  it("reads the billing identity from the latest invoice", async () => {
    const org = forOrg(db!, orgA);
    await org.recordInvoice(record({ stripeInvoiceId: "in_1", issuedAt: new Date("2026-01-01T00:00:00Z"), customerTaxId: "OLD" }));
    await org.recordInvoice(record({ stripeInvoiceId: "in_2", issuedAt: new Date("2026-05-01T00:00:00Z"), customerTaxId: "NEW", customerName: "Athar LLC" }));
    expect(await org.billingProfile()).toEqual({ name: "Athar LLC", country: "SA", taxId: "NEW" });
  });

  it("has no billing profile before the first invoice", async () => {
    expect(await forOrg(db!, orgA).billingProfile()).toBeNull();
  });

  // The webhook's fallback when an invoice carries none of our metadata — the
  // case for anything created outside our own checkout. Nested here so it
  // shares the one connection pool; a sibling describe would run after this
  // file's afterAll had already closed it.
  describe("orgIdForStripeCustomer", () => {
    it("maps a Stripe customer back to its workspace", async () => {
      await forOrg(db!, orgA).setStripeCustomerId("cus_lookup_test");
      expect(await orgIdForStripeCustomer(db!, "cus_lookup_test")).toBe(orgA);
    });

    it("returns null for an unknown or empty customer instead of guessing", async () => {
      expect(await orgIdForStripeCustomer(db!, "cus_does_not_exist")).toBeNull();
      expect(await orgIdForStripeCustomer(db!, "")).toBeNull();
    });
  });
});

it.runIf(!db)("skipped invoices: no DATABASE_URL", () => {
  expect(true).toBe(true);
});
