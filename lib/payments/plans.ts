/**
 * Subscription plans. Pure and shared by the billing UI and the server.
 *
 * A plan must UNLOCK something real, or selling it is taking money for a
 * promise the product doesn't keep. Both entitlements here are enforced:
 *  - `monthlyCredits` is granted on every paid invoice (see the Stripe webhook).
 *  - `sourcesLimit` is what the app shows and measures usage against.
 * Nothing else is implied — team seats, roles and multi-approval do NOT exist,
 * so no plan advertises them.
 */
export type PlanId = "free" | "pro" | "agency";

export type Plan = {
  id: PlanId;
  /** Monthly price in cents (0 = free). */
  amountCents: number;
  /** Credits granted for each paid billing period. */
  monthlyCredits: number;
  /** Knowledge sources the workspace may keep. */
  sourcesLimit: number;
};

export const PLANS: readonly Plan[] = [
  { id: "free", amountCents: 0, monthlyCredits: 0, sourcesLimit: 5 },
  { id: "pro", amountCents: 99_00, monthlyCredits: 3_000, sourcesLimit: 50 },
  { id: "agency", amountCents: 299_00, monthlyCredits: 12_000, sourcesLimit: 200 },
] as const;

export const FREE_PLAN = PLANS[0];

export function findPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/** The plan a workspace is entitled to. Anything unknown, or a subscription that
 * is no longer in good standing, falls back to free — the safe direction. */
export function effectivePlan(planId: string | null | undefined, status: string | null | undefined): Plan {
  const plan = findPlan(planId ?? "free");
  if (!plan || plan.id === "free") return FREE_PLAN;
  // Stripe keeps a subscription "active" through the paid period even once the
  // customer has cancelled; "past_due" still has access while retries run.
  const entitled = status === "active" || status === "trialing" || status === "past_due";
  return entitled ? plan : FREE_PLAN;
}

export function planPriceUsd(p: Plan): number {
  return p.amountCents / 100;
}
