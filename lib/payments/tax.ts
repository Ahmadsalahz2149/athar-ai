import type Stripe from "stripe";

/**
 * VAT and invoice mapping (Phase 8). Pure — no DB, no Stripe client, no
 * `server-only` — so every rule here is unit-testable against a plain object.
 *
 * Stripe is the system of record for invoices: it issues the sequential number
 * and renders the PDF a tax authority accepts. This module's job is to read a
 * Stripe invoice correctly and project it onto our row, which is less trivial
 * than it sounds — `invoice.tax` no longer exists in the current API. Tax is a
 * `total_taxes[]` array, and summing it is the only correct way to get the VAT
 * on an invoice.
 */

/**
 * Stripe Tax is OPT-IN and off by default, deliberately.
 *
 * `automatic_tax` makes Stripe reject a checkout outright when the account has
 * no tax registrations configured — so flipping it on before the dashboard is
 * ready would not add VAT, it would stop all payments. Off means the app bills
 * exactly as it does today.
 */
export function taxEnabled(): boolean {
  return process.env.STRIPE_TAX_ENABLED === "true";
}

/** Prices in the catalog are net; VAT is added on top. Stripe needs this stated
 * explicitly on inline prices or it assumes the account default, which silently
 * changes what the customer is charged. */
export const TAX_BEHAVIOR = "exclusive" as const;

export type InvoiceTotals = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** The amount VAT was calculated ON — the denominator for the rate. */
  taxableCents: number;
};

/** Sum every tax line on the invoice. There can be more than one (a country and
 * a province, say), so taking the first would under-report the VAT charged. */
export function invoiceTotals(inv: Pick<Stripe.Invoice, "subtotal" | "total" | "total_taxes">): InvoiceTotals {
  const taxes = inv.total_taxes ?? [];
  let taxCents = 0;
  let taxableCents = 0;
  for (const t of taxes) {
    taxCents += t.amount ?? 0;
    taxableCents += t.taxable_amount ?? 0;
  }
  return {
    subtotalCents: inv.subtotal ?? 0,
    taxCents,
    totalCents: inv.total ?? 0,
    // With no tax line at all, the subtotal is what would have been taxed.
    taxableCents: taxes.length ? taxableCents : (inv.subtotal ?? 0),
  };
}

/**
 * Effective VAT rate in BASIS POINTS (15% → 1500).
 *
 * Derived from the amounts rather than read from the tax rate object, because
 * `total_taxes[].tax_rate_details` carries only a tax-rate id — resolving it to
 * a percentage would need another API call per invoice, and the derived rate is
 * what the customer was actually charged anyway.
 */
export function taxRateBps(taxCents: number, taxableCents: number): number | null {
  if (taxableCents <= 0) return null;
  if (taxCents === 0) return 0; // genuinely zero-rated (reverse charge, exempt)
  return Math.round((taxCents / taxableCents) * 10_000);
}

/** Basis points back to a display percentage: 1500 → 15, 775 → 7.75. */
export function bpsToPercent(bps: number): number {
  return Math.round(bps) / 100;
}

/** The customer's VAT/tax registration number as printed on the invoice. */
export function customerTaxId(inv: Pick<Stripe.Invoice, "customer_tax_ids">): string | null {
  const first = inv.customer_tax_ids?.find((t) => t.value);
  return first?.value ?? null;
}

/**
 * Which invoice states are worth keeping.
 *
 * A `draft` is not a document yet — it has no number and can still change, so
 * recording it would show the customer an invoice that may never exist. Every
 * other state is a real issued document, `void` included: an invoice that was
 * cancelled still has to be visible, not silently deleted.
 */
export function isRecordableStatus(status: Stripe.Invoice["status"] | null | undefined): boolean {
  return status === "open" || status === "paid" || status === "uncollectible" || status === "void";
}

export type InvoiceRecord = {
  stripeInvoiceId: string;
  number: string | null;
  status: string;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  taxRateBps: number | null;
  customerName: string | null;
  customerCountry: string | null;
  customerTaxId: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  issuedAt: Date;
};

const secondsToDate = (s: number | null | undefined): Date | null =>
  typeof s === "number" ? new Date(s * 1000) : null;

/** Project a Stripe invoice onto the row we store. */
export function toInvoiceRecord(inv: Stripe.Invoice): InvoiceRecord {
  const totals = invoiceTotals(inv);
  return {
    stripeInvoiceId: inv.id!,
    number: inv.number ?? null,
    status: inv.status ?? "open",
    currency: inv.currency,
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    amountPaidCents: inv.amount_paid ?? 0,
    taxRateBps: taxRateBps(totals.taxCents, totals.taxableCents),
    customerName: inv.customer_name ?? null,
    customerCountry: inv.customer_address?.country ?? null,
    customerTaxId: customerTaxId(inv),
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    invoicePdfUrl: inv.invoice_pdf ?? null,
    periodStart: secondsToDate(inv.period_start),
    periodEnd: secondsToDate(inv.period_end),
    // `status_transitions.finalized_at` is when the document was issued; fall
    // back to creation for an invoice that has not been finalized yet.
    issuedAt: secondsToDate(inv.status_transitions?.finalized_at) ?? secondsToDate(inv.created) ?? new Date(),
  };
}

/**
 * Which org an invoice belongs to, from the invoice alone.
 *
 * Metadata first, because we write it ourselves at checkout and it survives
 * everything. The subscription path carries it one level down, on the parent.
 * A customer-id lookup is the caller's fallback when neither is present.
 */
export function orgIdFromInvoice(inv: Stripe.Invoice): string | null {
  return (
    inv.metadata?.orgId ||
    inv.parent?.subscription_details?.metadata?.orgId ||
    null
  );
}

/** The Stripe customer id, whether the field is expanded or just an id. */
export function customerIdFromInvoice(inv: Stripe.Invoice): string | null {
  const c = inv.customer;
  if (!c) return null;
  return typeof c === "string" ? c : c.id;
}

/** Money for display: 2_900 → "29.00". The caller adds the currency label so
 * the Arabic and English screens can place it on the right side. */
export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
