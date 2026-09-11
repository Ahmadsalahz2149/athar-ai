import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { getStripe } from "@/lib/payments/stripe";
import { findPack } from "@/lib/payments/catalog";
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

  // Both the sync card path and the delayed (bank/async) path land here.
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return Response.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
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
