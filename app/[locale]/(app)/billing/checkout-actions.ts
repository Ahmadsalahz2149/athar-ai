"use server";

import { db } from "@/lib/db";
import { currentContext } from "@/lib/auth/current";
import { findPack, CURRENCY } from "@/lib/payments/catalog";
import { taxEnabled, TAX_BEHAVIOR } from "@/lib/payments/tax";
import { findPlan } from "@/lib/payments/plans";
import { forOrg } from "@/lib/db/forOrg";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getStripe, publicBaseUrl } from "@/lib/payments/stripe";
import { consume } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * The VAT half of a Checkout session, shared by packs and subscriptions.
 *
 * `automatic_tax` is gated on STRIPE_TAX_ENABLED because Stripe REJECTS a
 * session with automatic tax when the account has no tax registrations — so
 * turning it on before the dashboard is ready would not add VAT, it would break
 * every checkout. Off, the app bills exactly as it does today.
 *
 * The address and tax-id collection are unconditional: they are what makes an
 * invoice a valid tax document, and what lets a registered business be
 * reverse-charged instead of paying VAT it would have to reclaim.
 */
function taxOptions() {
  return {
    billing_address_collection: "required" as const,
    // Save what the customer types back onto the customer, so the next invoice
    // and the billing portal already know it.
    customer_update: { address: "auto" as const, name: "auto" as const },
    tax_id_collection: { enabled: true },
    automatic_tax: { enabled: taxEnabled() },
  };
}

/**
 * Start a Stripe Checkout session for a credit pack.
 *
 * The client sends only a pack ID. Credits and price are read from the
 * server-side catalog, so the amount charged and the credits granted can never
 * be chosen by the caller. The org is resolved from the session and carried in
 * the session metadata — that is what the webhook credits, never anything the
 * browser sends back.
 */
export async function startCheckout(packId: string, locale = "ar"): Promise<CheckoutResult> {
  if (!db) return { ok: false, error: "unavailable" };
  const ctx = await currentContext();
  if (!ctx) return { ok: false, error: "no_session" };

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "payments_disabled" };

  const pack = findPack(packId);
  if (!pack) return { ok: false, error: "unknown_pack" };

  if (!consume(`checkout:${ctx.orgId}`, 10, 10 * 60_000).ok) return { ok: false, error: "rate_limited" };

  const base = publicBaseUrl();
  const loc = locale === "en" ? "en" : "ar";
  try {
    // A one-off payment gets a real customer too. Without one there is nothing
    // to attach the address and VAT number to, and the invoice below could not
    // be traced back to this workspace.
    const customerId = await ensureCustomer(ctx.orgId);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: ctx.orgId,
      // Priced inline from the catalog so there is no second source of truth to
      // drift in the Stripe dashboard.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: pack.amountCents,
            // Catalog prices are NET. Stated explicitly, because leaving it to
            // the account default silently changes what the customer is charged.
            tax_behavior: TAX_BEHAVIOR,
            product_data: { name: `Athar — ${pack.credits} credits` },
          },
        },
      ],
      // A one-off payment does NOT produce an invoice unless asked. Without
      // this the customer has a receipt but no numbered tax document — which is
      // the thing a business actually has to file.
      invoice_creation: {
        enabled: true,
        invoice_data: { metadata: { orgId: ctx.orgId, packId: pack.id } },
      },
      ...taxOptions(),
      metadata: { orgId: ctx.orgId, packId: pack.id, credits: String(pack.credits) },
      success_url: `${base}/${loc}/billing?purchase=success`,
      cancel_url: `${base}/${loc}/billing?purchase=cancelled`,
    });
    if (!session.url) return { ok: false, error: "failed" };
    return { ok: true, url: session.url };
  } catch (e) {
    log.error("stripe.checkout_failed", { orgId: ctx.orgId, packId }, e);
    return { ok: false, error: "failed" };
  }
}


/** Reuse one Stripe customer per workspace so checkouts, the portal and the
 * subscription all hang off the same record instead of a new customer each time. */
async function ensureCustomer(orgId: string): Promise<string> {
  const stripe = getStripe()!;
  const org = forOrg(db!, orgId);
  const state = await org.planState();
  if (state.stripeCustomerId) return state.stripeCustomerId;

  const supabase = await getSupabaseServer();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const customer = await stripe.customers.create({
    email: data.user?.email ?? undefined,
    metadata: { orgId },
  });
  await org.setStripeCustomerId(customer.id);
  return customer.id;
}

/**
 * Start a subscription checkout. Like the packs, the price and the plan come
 * from the server-side catalog — the browser sends a plan id and nothing else.
 * The org id is written into the SUBSCRIPTION metadata so every later lifecycle
 * event (renewal, cancellation) can be attributed without a lookup.
 */
export async function startSubscription(planId: string, locale = "ar"): Promise<CheckoutResult> {
  if (!db) return { ok: false, error: "unavailable" };
  const ctx = await currentContext();
  if (!ctx) return { ok: false, error: "no_session" };

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "payments_disabled" };

  const plan = findPlan(planId);
  if (!plan || plan.amountCents === 0) return { ok: false, error: "unknown_plan" };

  if (!consume(`subscribe:${ctx.orgId}`, 10, 10 * 60_000).ok) return { ok: false, error: "rate_limited" };

  const base = publicBaseUrl();
  const loc = locale === "en" ? "en" : "ar";
  try {
    const customerId = await ensureCustomer(ctx.orgId);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: plan.amountCents,
            tax_behavior: TAX_BEHAVIOR,
            recurring: { interval: "month" },
            product_data: { name: `Athar ${plan.id} — ${plan.monthlyCredits} credits/month` },
          },
        },
      ],
      // Carried onto the subscription, so renewals and cancellations arrive
      // already attributed to this workspace — and so every renewal INVOICE
      // arrives attributed too, via parent.subscription_details.metadata.
      subscription_data: { metadata: { orgId: ctx.orgId, planId: plan.id } },
      ...taxOptions(),
      metadata: { orgId: ctx.orgId, planId: plan.id },
      success_url: `${base}/${loc}/billing?purchase=subscribed`,
      cancel_url: `${base}/${loc}/billing?purchase=cancelled`,
    });
    if (!session.url) return { ok: false, error: "failed" };
    return { ok: true, url: session.url };
  } catch (e) {
    log.error("stripe.subscribe_failed", { orgId: ctx.orgId, planId }, e);
    return { ok: false, error: "failed" };
  }
}

/**
 * Open Stripe's billing portal so the customer can change card, see invoices,
 * or CANCEL. Self-service cancellation is not optional — a subscription people
 * cannot end on their own is a support burden and a consumer-law problem.
 */
export async function openBillingPortal(locale = "ar"): Promise<CheckoutResult> {
  if (!db) return { ok: false, error: "unavailable" };
  const ctx = await currentContext();
  if (!ctx) return { ok: false, error: "no_session" };
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "payments_disabled" };

  const { stripeCustomerId } = await forOrg(db, ctx.orgId).planState();
  if (!stripeCustomerId) return { ok: false, error: "no_subscription" };

  const loc = locale === "en" ? "en" : "ar";
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${publicBaseUrl()}/${loc}/billing`,
    });
    return { ok: true, url: portal.url };
  } catch (e) {
    log.error("stripe.portal_failed", { orgId: ctx.orgId }, e);
    return { ok: false, error: "failed" };
  }
}
