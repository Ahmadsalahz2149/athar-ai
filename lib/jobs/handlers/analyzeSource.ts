import { forOrg } from "@/lib/db/forOrg";
import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/json";
import { normalizeAnalysis } from "@/lib/ai/normalize";
import { estimateAnalyze } from "@/lib/credits/costs";
import { ANALYSIS_SYSTEM, ANALYSIS_SCHEMA, buildAnalysisUserMessage } from "@/lib/ai/prompts";
import type { JobHandler } from "../runner";

export type AnalyzeJobPayload = { sourceId: string };

/** Background analysis of a source's chunks → persisted analysis (summary, key
 * ideas, quotes, opportunities). Runs after ingestion when the user asked for
 * ideas/DNA. Skips silently if no provider key or no chunks (nothing to retry). */
export const analyzeSourceHandler: JobHandler = async ({ db, job, progress }) => {
  const { sourceId } = job.payload as unknown as AnalyzeJobPayload;
  const provider = currentProvider();
  if (!hasKeyFor(provider)) return { skipped: "no_key" };

  const org = forOrg(db, job.orgId);
  await progress(20, "load");
  const chunks = await org.sourceChunkTexts(job.brandId, sourceId, 40);
  if (!chunks.length) return { skipped: "no_chunks" };

  await progress(50, "analyze");
  const res = await generateText({
    system: ANALYSIS_SYSTEM,
    user: buildAnalysisUserMessage(chunks),
    maxTokens: 4096,
    anthropicModel: process.env.ANTHROPIC_DNA_MODEL || MODELS.SONNET,
    schema: ANALYSIS_SCHEMA,
    provider,
  });
  if (res.truncated) throw new Error("analysis output hit the token cap");

  await progress(85, "store");
  const analysis = normalizeAnalysis(extractJson<unknown>(res.text));
  await org.saveAnalysis(job.brandId, sourceId, {
    summary: analysis.summary,
    keyIdeas: analysis.key_ideas,
    quotes: analysis.quotes,
    audience: analysis.audience_problems,
    opportunities: analysis.content_opportunities,
  });
  await org.debitOnce(estimateAnalyze(), "analyze_source", `analyze:${sourceId}`, "source", sourceId);
  return { sourceId };
};
