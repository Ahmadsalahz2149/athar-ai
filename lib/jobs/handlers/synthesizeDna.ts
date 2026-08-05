import { forOrg } from "@/lib/db/forOrg";
import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/json";
import { normalizeDna } from "@/lib/ai/normalize";
import { estimateDna } from "@/lib/credits/costs";
import { DNA_SYSTEM, DNA_SCHEMA, buildDnaUserMessage } from "@/lib/ai/prompts";
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

  await progress(50, "synthesize");
  const res = await generateText({
    system: DNA_SYSTEM,
    user: buildDnaUserMessage(samples),
    maxTokens: 4096,
    anthropicModel: process.env.ANTHROPIC_DNA_MODEL || MODELS.OPUS,
    schema: DNA_SCHEMA,
    provider,
  });
  if (res.truncated) throw new Error("dna output hit the token cap");

  await progress(85, "store");
  const dna = normalizeDna(extractJson<unknown>(res.text));
  const versionId = await org.saveDna(job.brandId, dna);
  // Charge once per synthesis trigger so a retried job never double-bills.
  const trigger = (job.payload as unknown as SynthesizeDnaPayload)?.trigger ?? job.id;
  await org.debitOnce(estimateDna(), "synthesize_dna", `dna:${trigger}`, "brand", job.brandId);
  await progress(100, "done");
  return { versionId, completion: dna.completion_pct };
};
