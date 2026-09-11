"use server";

import { db } from "@/lib/db";
import { currentContext } from "@/lib/auth/current";
import { findPack, CURRENCY } from "@/lib/payments/catalog";
import { getStripe, publicBaseUrl } from "@/lib/payments/stripe";
import { consume } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

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
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: ctx.orgId,
      // Priced inline from the catalog so there is no second source of truth to
      // drift in the Stripe dashboard.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: pack.amountCents,
            product_data: { name: `Athar — ${pack.credits} credits` },
          },
        },
      ],
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
