import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { getStripe } from "@/lib/payments/stripe";
import { findPack } from "@/lib/payments/catalog";
import { findPlan } from "@/lib/payments/plans";
import { isRecordableStatus, toInvoiceRecord, orgIdFromInvoice, customerIdFromInvoice } from "@/lib/payments/tax";
import { orgIdForStripeCustomer } from "@/lib/payments/lookup";
import { log } from "@/lib/log";
import type Stripe from "stripe";

/**
 * Stripe webhook — the ONLY place credits are granted for a payment.
 *
 * Never credit from the browser returning to success_url: that URL can be
 * opened by anyone, and a real payment can also complete after the customer
 * closes the tab. Stripe's signed webhook is the authority.
 *
 * Stripe delivers at least once and retries every non-2xx, so the same event
 * WILL arrive more than once. The grant is keyed on the checkout session id and
 * the ledger's unique (org_id, idempotency_key) index makes the replay a no-op.
 */
export const dynamic = "force-dynamic";

/** Period end moved onto subscription ITEMS in recent Stripe API versions; it is
 * no longer a field on the subscription object. */
function periodEnd(sub: Stripe.Subscription): Date | null {
  const ts = sub.items?.data?.[0]?.current_period_end;
  return typeof ts === "number" ? new Date(ts * 1000) : null;
}

/** Project a subscription onto the org it belongs to. The org id rides in the
 * subscription metadata (written at checkout), so no cross-org lookup is needed. */
async function syncSubscription(sub: Stripe.Subscription): Promise<boolean> {
  const orgId = sub.metadata?.orgId;
  const planId = sub.metadata?.planId;
  if (!orgId || !findPlan(planId ?? "")) {
    log.error("stripe.unmappable_subscription", { subscriptionId: sub.id, orgId, planId });
    return false;
  }
  // A subscription that has ended drops the workspace back to free. Access
  // during a cancelled-but-paid period is handled by effectivePlan(), which
  // keeps "active" entitlements until the period actually lapses.
  const ended = sub.status === "canceled" || sub.status === "incomplete_expired";
  await forOrg(db!, orgId).applySubscription({
    plan: ended ? "free" : planId!,
    status: sub.status,
    subscriptionId: sub.id,
    renewsAt: periodEnd(sub),
  });
  log.info("stripe.subscription_synced", { orgId, plan: ended ? "free" : planId, status: sub.status });
  return true;
}


/**
 * Store the tax invoice behind a payment.
 *
 * Every charge — a subscription renewal or a one-off credit pack — produces a
 * Stripe invoice with a sequential number, the VAT breakdown and a PDF. That
 * document is what a customer files and what a tax authority asks for, so it
 * must be reachable from inside the product rather than only from a Stripe
 * email that may never arrive.
 *
 * Never fatal: a payment that succeeded must not be re-driven by Stripe because
 * our bookkeeping copy failed to save. The credits are the part that has to be
 * right on retry; the invoice can be re-recorded by any later event on it.
 */
async function recordInvoice(inv: Stripe.Invoice): Promise<void> {
  try {
    if (!inv.id || !isRecordableStatus(inv.status)) return;
    const orgId = orgIdFromInvoice(inv) ?? (await orgIdForStripeCustomer(db!, customerIdFromInvoice(inv) ?? ""));
    if (!orgId) {
      log.error("stripe.unmappable_invoice", { invoiceId: inv.id, customer: customerIdFromInvoice(inv) });
      return;
    }
    const record = toInvoiceRecord(inv);
    await forOrg(db!, orgId).recordInvoice(record);
    log.info("stripe.invoice_recorded", {
      orgId, invoiceId: inv.id, number: record.number, status: record.status,
      totalCents: record.totalCents, taxCents: record.taxCents,
    });
  } catch (e) {
    log.error("stripe.invoice_record_failed", { invoiceId: inv.id }, e);
  }
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret || !db) return new Response("not_configured", { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing_signature", { status: 400 });

  // The raw body is required — any parsing or re-serialization breaks the signature.
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch (e) {
    // An unverified payload is either a misconfiguration or a forgery; either
    // way it must never reach the ledger.
    log.error("stripe.bad_signature", {}, e);
    return new Response("bad_signature", { status: 400 });
  }

  // --- Subscription lifecycle: created, renewed, plan changed, cancelled ---
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await syncSubscription(event.data.object as Stripe.Subscription);
    return Response.json({ received: true });
  }

  // --- Tax invoices. `finalized` is when the document gets its number, `paid`
  // when it is settled, and the rest are the states it can end in; each is
  // recorded onto the same row so the history tracks reality. ---
  if (
    event.type === "invoice.finalized" ||
    event.type === "invoice.paid" ||
    event.type === "invoice.voided" ||
    event.type === "invoice.marked_uncollectible"
  ) {
    await recordInvoice(event.data.object as Stripe.Invoice);
    return Response.json({ received: true });
  }

  // --- Recurring credits: fires on the first payment AND every renewal, which
  // is what makes the monthly allowance automatic with no cron of our own. ---
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    // Record first: the credit grant below returns early for anything that is
    // not a plan invoice, and a credit-pack invoice still needs storing.
    await recordInvoice(invoice);
    const details = invoice.parent?.subscription_details;
    const orgId = details?.metadata?.orgId;
    const plan = findPlan(details?.metadata?.planId ?? "");
    if (!orgId || !plan || plan.monthlyCredits <= 0) {
      return Response.json({ received: true, ignored: "not_a_plan_invoice" });
    }
    try {
      const balance = await forOrg(db, orgId).grantOnceKeyed(
        plan.monthlyCredits,
        "subscription_credits",
        // Keyed per INVOICE, so each billing period credits once while replays
        // of the same invoice are free.
        `stripe_invoice:${invoice.id}`,
        "stripe",
      );
      log.info("stripe.subscription_credits", { orgId, plan: plan.id, credits: plan.monthlyCredits, balance });
      return Response.json({ received: true });
    } catch (e) {
      log.error("stripe.subscription_credit_failed", { orgId, invoiceId: invoice.id }, e);
      return new Response("grant_failed", { status: 500 });
    }
  }

  // --- One-off credit packs ---
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return Response.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  // Subscription checkouts are credited by invoice.payment_succeeded above;
  // crediting here too would double-grant the first month.
  if (session.mode === "subscription") {
    return Response.json({ received: true, handled: "subscription_checkout" });
  }
  if (session.payment_status !== "paid") {
    return Response.json({ received: true, pending: session.payment_status });
  }

  const orgId = session.metadata?.orgId || session.client_reference_id || "";
  const packId = session.metadata?.packId || "";
  const pack = findPack(packId);
  if (!orgId || !pack) {
    // 200 on purpose: retrying will not fix a session we cannot map, and a
    // permanent 4xx would have Stripe retry it for days.
    log.error("stripe.unmappable_session", { sessionId: session.id, orgId, packId });
    return Response.json({ received: true, error: "unmappable" });
  }

  try {
    const balance = await forOrg(db, orgId).grantOnceKeyed(
      pack.credits,
      "purchase",
      // ref_id is a uuid column, so the Stripe id lives in the idempotency key.
      `stripe:${session.id}`,
      "stripe",
    );
    log.info("stripe.credits_granted", { orgId, packId: pack.id, credits: pack.credits, balance });
    return Response.json({ received: true });
  } catch (e) {
    // Let Stripe retry: a failed grant here means a paid customer has no credits.
    log.error("stripe.grant_failed", { orgId, packId: pack.id, sessionId: session.id }, e);
    return new Response("grant_failed", { status: 500 });
  }
}
