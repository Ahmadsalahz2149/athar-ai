import { forOrg } from "@/lib/db/forOrg";
import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/json";
import { normalizeDna } from "@/lib/ai/normalize";
import { estimateDna } from "@/lib/credits/costs";
import { DNA_SYSTEM, DNA_SCHEMA, buildDnaUserMessage } from "@/lib/ai/prompts";
import { composePost } from "@/lib/social/publish";
import { engagementScore } from "@/lib/social/metrics";
import { canAfford, chargeForDeliveredWork } from "../billing";
import type { JobHandler } from "../runner";

export type SynthesizeDnaPayload = { trigger?: string };

/**
 * Synthesize the brand's Content DNA from its uploaded writing samples (all
 * sources' chunks). This is the core "AI learns your voice" step — it reads the
 * user's own posts and extracts tone, dialect, hooks, pillars, etc., then saves
 * a new DNA version. Runs after ingestion (chained) and on demand from the DNA
 * page. Skips silently when there's nothing to learn from yet.
 */
export const synthesizeDnaHandler: JobHandler = async ({ db, job, progress }) => {
  const provider = currentProvider();
  if (!hasKeyFor(provider)) return { skipped: "no_key" };

  const org = forOrg(db, job.orgId);
  await progress(20, "gather");
  const samples = await org.brandSampleText(job.brandId, 40);
  if (samples.trim().length < 120) return { skipped: "no_samples" };

  // The feedback loop. Published posts the audience actually responded to are
  // the same voice as the samples with one extra fact attached, so they go in
  // as a separately weighted block — this is what makes the DNA improve with
  // use rather than stay frozen at whatever the first upload implied.
  //
  // Best-effort: a brand with no published posts, or no metrics yet, simply
  // synthesises from its sources exactly as before.
  const proven = await topPerformingPosts(org, job.brandId);

  // Pay-gate BEFORE the Opus call, not after the DNA is saved.
  const cost = estimateDna();
  if (!(await canAfford(db, job.orgId, cost))) return { skipped: "insufficient_credits" };

  await progress(50, "synthesize");
  const res = await generateText({
    system: DNA_SYSTEM,
    user: buildDnaUserMessage(samples, proven.text),
    maxTokens: 4096,
    anthropicModel: process.env.ANTHROPIC_DNA_MODEL || MODELS.OPUS,
    schema: DNA_SCHEMA,
    provider,
  });
  if (res.truncated) throw new Error("dna output hit the token cap");

  await progress(85, "store");
  const dna = normalizeDna(extractJson<unknown>(res.text));
  const versionId = await org.saveDna(job.brandId, dna, proven.learnedFrom);
  // Charge once per synthesis trigger so a retried job never double-bills.
  const trigger = (job.payload as unknown as SynthesizeDnaPayload)?.trigger ?? job.id;
  await chargeForDeliveredWork(db, job.orgId, cost, "synthesize_dna", `dna:${trigger}`, "brand", job.brandId);
  await progress(100, "done");
  return { versionId, completion: dna.completion_pct, learnedFromPosts: proven.learnedFrom.length };
};

/** How many proven posts to feed back. Enough to show a pattern, few enough
 * that they inform the voice rather than replace the source material. */
const PROVEN_LIMIT = 8;
/** Recent enough to reflect the audience the brand has now. */
const PROVEN_DAYS = 90;

/**
 * The brand's published posts that actually performed, highest first.
 *
 * Ranked by the same weighted score the analytics screen uses, so "best" means
 * one thing across the product. Posts with no measurement are excluded rather
 * than treated as zero — an unmeasured post is not a failed one.
 */
async function topPerformingPosts(
  org: ReturnType<typeof forOrg>,
  brandId: string,
): Promise<{ text: string; learnedFrom: { draftId: string; hook: string; engagement: number }[] }> {
  try {
    const posts = await org.measuredPosts(brandId, PROVEN_DAYS);
    const ranked = posts
      .map((p) => ({ post: p, engagement: engagementScore(p) }))
      .filter((r): r is { post: (typeof posts)[number]; engagement: number } => r.engagement !== null && r.engagement > 0)
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, PROVEN_LIMIT);

    return {
      text: ranked.map((r, i) => `[${i + 1}] ${composePost(r.post.hook, r.post.body)}`).join("\n\n"),
      learnedFrom: ranked.map((r) => ({ draftId: r.post.draftId, hook: r.post.hook.slice(0, 120), engagement: r.engagement })),
    };
  } catch {
    // Never let the feedback half break synthesis itself — a DNA built from
    // sources alone is the previous, working behaviour.
    return { text: "", learnedFrom: [] };
  }
}
