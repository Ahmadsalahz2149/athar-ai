import { describe, it, expect, afterEach } from "vitest";
import type Stripe from "stripe";
import {
  TAX_BEHAVIOR, bpsToPercent, customerIdFromInvoice, customerTaxId, formatAmount,
  invoiceTotals, isRecordableStatus, orgIdFromInvoice, taxEnabled, taxRateBps, toInvoiceRecord,
} from "@/lib/payments/tax";

/** A Stripe invoice as the CURRENT API shapes it: tax lives in `total_taxes[]`,
 * not in a `tax` field. Building fixtures through this helper is what keeps the
 * tests honest about the shape we actually parse. */
function invoice(over: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
  return {
    id: "in_1",
    object: "invoice",
    number: "ATH-0001",
    status: "paid",
    currency: "usd",
    subtotal: 9900,
    total: 11385,
    amount_paid: 11385,
    created: 1_700_000_000,
    period_start: 1_700_000_000,
    period_end: 1_702_592_000,
    customer: "cus_1",
    customer_name: "Athar Co",
    customer_address: { country: "SA", city: null, line1: null, line2: null, postal_code: null, state: null },
    customer_tax_ids: [{ type: "sa_vat", value: "310000000000003" }],
    hosted_invoice_url: "https://invoice.stripe.com/i/1",
    invoice_pdf: "https://invoice.stripe.com/i/1.pdf",
    status_transitions: { finalized_at: 1_700_000_500, marked_uncollectible_at: null, paid_at: 1_700_000_600, voided_at: null },
    total_taxes: [{ amount: 1485, taxable_amount: 9900, tax_behavior: "exclusive", taxability_reason: "standard_rated", tax_rate_details: null, type: "tax_rate_details" }],
    metadata: {},
    ...over,
  } as unknown as Stripe.Invoice;
}

afterEach(() => { delete process.env.STRIPE_TAX_ENABLED; });

describe("Stripe Tax gate", () => {
  // Enabling automatic_tax without registrations makes Stripe REJECT the
  // checkout — so the default must be off, or turning payments on breaks them.
  it("is off unless explicitly enabled", () => {
    expect(taxEnabled()).toBe(false);
    process.env.STRIPE_TAX_ENABLED = "1";
    expect(taxEnabled()).toBe(false);
    process.env.STRIPE_TAX_ENABLED = "true";
    expect(taxEnabled()).toBe(true);
  });

  it("bills catalog prices as net, with VAT added on top", () => {
    expect(TAX_BEHAVIOR).toBe("exclusive");
  });
});

describe("invoiceTotals", () => {
  it("sums every tax line, not just the first", () => {
    const t = invoiceTotals(invoice({
      subtotal: 10000,
      total: 11200,
      total_taxes: [
        { amount: 700, taxable_amount: 10000 },
        { amount: 500, taxable_amount: 10000 },
      ],
    } as unknown as Partial<Stripe.Invoice>));
    expect(t.taxCents).toBe(1200);
    expect(t.taxableCents).toBe(20000); // each line reports its own base
  });

  it("reads the 15% Saudi VAT case", () => {
    const t = invoiceTotals(invoice());
    expect(t).toEqual({ subtotalCents: 9900, taxCents: 1485, totalCents: 11385, taxableCents: 9900 });
  });

  it("falls back to the subtotal as the base when there is no tax at all", () => {
    const t = invoiceTotals(invoice({ total_taxes: null, subtotal: 2900, total: 2900 }));
    expect(t).toEqual({ subtotalCents: 2900, taxCents: 0, totalCents: 2900, taxableCents: 2900 });
  });
});

describe("taxRateBps", () => {
  it("derives the exact rate the customer was charged", () => {
    expect(taxRateBps(1485, 9900)).toBe(1500); // 15% — Saudi Arabia
    expect(taxRateBps(1450, 29000)).toBe(500); // 5% — UAE/Bahrain/Oman
  });

  // Stored as basis points precisely so this does not print as 14.999%.
  it("keeps an awkward rate exact", () => {
    expect(bpsToPercent(taxRateBps(775, 10000)!)).toBe(7.75);
    expect(bpsToPercent(1500)).toBe(15);
  });

  it("distinguishes zero-rated from unknown", () => {
    expect(taxRateBps(0, 9900)).toBe(0); // reverse charge / exempt: really 0%
    expect(taxRateBps(0, 0)).toBeNull(); // nothing to compute from
    expect(taxRateBps(100, -1)).toBeNull();
  });
});

describe("invoice identity", () => {
  it("prefers our own metadata", () => {
    expect(orgIdFromInvoice(invoice({ metadata: { orgId: "org-a" } }))).toBe("org-a");
  });

  // Subscription renewals carry it one level down, on the invoice's parent.
  it("finds the org on a subscription renewal", () => {
    const inv = invoice({ metadata: {}, parent: { subscription_details: { metadata: { orgId: "org-b" } } } } as unknown as Partial<Stripe.Invoice>);
    expect(orgIdFromInvoice(inv)).toBe("org-b");
  });

  it("returns null when there is nothing to map, rather than guessing", () => {
    expect(orgIdFromInvoice(invoice({ metadata: {} }))).toBeNull();
  });

  it("reads the customer id whether expanded or not", () => {
    expect(customerIdFromInvoice(invoice())).toBe("cus_1");
    expect(customerIdFromInvoice(invoice({ customer: { id: "cus_2" } } as unknown as Partial<Stripe.Invoice>))).toBe("cus_2");
    expect(customerIdFromInvoice(invoice({ customer: null }))).toBeNull();
  });

  it("picks up a Gulf VAT registration number", () => {
    expect(customerTaxId(invoice())).toBe("310000000000003");
    expect(customerTaxId(invoice({ customer_tax_ids: [] }))).toBeNull();
    expect(customerTaxId(invoice({ customer_tax_ids: null }))).toBeNull();
  });
});

describe("isRecordableStatus", () => {
  // A draft has no number and can still change — showing it would promise the
  // customer a document that may never be issued.
  it("skips drafts", () => {
    expect(isRecordableStatus("draft")).toBe(false);
    expect(isRecordableStatus(null)).toBe(false);
  });

  it("keeps every issued document, cancelled ones included", () => {
    for (const s of ["open", "paid", "uncollectible", "void"] as const) {
      expect(isRecordableStatus(s)).toBe(true);
    }
  });
});

describe("toInvoiceRecord", () => {
  it("projects the whole document, VAT and identity included", () => {
    const r = toInvoiceRecord(invoice());
    expect(r).toMatchObject({
      stripeInvoiceId: "in_1",
      number: "ATH-0001",
      status: "paid",
      currency: "usd",
      subtotalCents: 9900,
      taxCents: 1485,
      totalCents: 11385,
      amountPaidCents: 11385,
      taxRateBps: 1500,
      customerName: "Athar Co",
      customerCountry: "SA",
      customerTaxId: "310000000000003",
      invoicePdfUrl: "https://invoice.stripe.com/i/1.pdf",
    });
    // Issued = finalized, not created: that is the date printed on the document.
    expect(r.issuedAt.getTime()).toBe(1_700_000_500 * 1000);
  });

  it("falls back to the created date when nothing has been finalized", () => {
    const r = toInvoiceRecord(invoice({ status_transitions: { finalized_at: null } } as unknown as Partial<Stripe.Invoice>));
    expect(r.issuedAt.getTime()).toBe(1_700_000_000 * 1000);
  });

  it("handles a reverse-charged B2B invoice: a tax number and no VAT", () => {
    const r = toInvoiceRecord(invoice({
      total: 9900,
      amount_paid: 9900,
      total_taxes: [{ amount: 0, taxable_amount: 9900, taxability_reason: "reverse_charge" }],
    } as unknown as Partial<Stripe.Invoice>));
    expect(r.taxCents).toBe(0);
    expect(r.taxRateBps).toBe(0);
    expect(r.totalCents).toBe(9900);
    expect(r.customerTaxId).toBe("310000000000003");
  });
});

describe("formatAmount", () => {
  it("renders cents as money without float drift", () => {
    expect(formatAmount(11385)).toBe("113.85");
    expect(formatAmount(0)).toBe("0.00");
    expect(formatAmount(2900)).toBe("29.00");
    // 0.1 + 0.2 territory: the cents are integers, so this stays exact.
    expect(formatAmount(1010)).toBe("10.10");
  });
});
