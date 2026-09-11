import "server-only";
import Stripe from "stripe";

/**
 * Stripe client. Payments are OPT-IN: with no secret key configured this returns
 * null and the billing UI keeps showing packs as unavailable, exactly as it did
 * before checkout existed. Nothing here runs, or fails, on a deployment that
 * has not set the keys.
 */
let cached: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  // Let the SDK use its own pinned API version rather than hard-coding one that
  // can drift out of sync with the installed types.
  cached = key ? new Stripe(key) : null;
  return cached;
}

export function paymentsEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Base URL for Stripe's return redirects; shares OAUTH_BASE_URL with the social callbacks. */
export function publicBaseUrl(): string {
  return (process.env.OAUTH_BASE_URL || "https://athargrowth.com").replace(/\/$/, "");
}
