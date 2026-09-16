"use server";

import { recordReviewDecision, type ReviewDecision } from "@/lib/review/publicReview";
import { consume, LIMITS } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

/**
 * The client's answer on one post, from an unauthenticated page.
 *
 * Rate-limited by IP: this is an open surface guarded only by a bearer token,
 * so without a cap it is an oracle you can grind against, and it is also the
 * only unauthenticated WRITE path in the product besides the link page's
 * counters.
 */
export async function decide(token: string, draftId: string, decision: ReviewDecision, note?: string): Promise<{ ok: boolean; error?: string }> {
  if (!consume(`review:decide:${await clientIp()}`, LIMITS.reviewDecision.limit, LIMITS.reviewDecision.windowMs).ok) {
    return { ok: false, error: "rate_limited" };
  }
  const res = await recordReviewDecision(token, draftId, decision, note);
  return res.ok ? { ok: true } : { ok: false, error: res.reason };
}
