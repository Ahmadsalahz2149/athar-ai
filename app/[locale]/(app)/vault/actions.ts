"use server";

import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/json";
import { normalizeAnalysis } from "@/lib/ai/normalize";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { estimateAnalyze } from "@/lib/credits/costs";
import {
  ANALYSIS_SYSTEM,
  ANALYSIS_SCHEMA,
  buildAnalysisUserMessage,
  type FileAnalysis,
} from "@/lib/ai/prompts";

export type AnalyzeResult =
  | { ok: true; analysis: FileAnalysis }
  | {
      ok: false;
      error: "no_key" | "no_session" | "no_chunks" | "insufficient_credits" | "failed";
      message?: string;
    };

/** Turn a source's extracted key-ideas into reusable Ideas Bank entries (linked
 * to the source). Powers "أضف لبنك الأفكار" on the File Analysis screen. */
export async function ideasFromAnalysis(sourceId: string): Promise<{ ok: boolean; n: number }> {
  try {
    if (!db) return { ok: false, n: 0 };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, n: 0 };
    const t = forOrg(db, ctx.orgId);
    const row = await t.getAnalysis(ctx.brandId, sourceId);
    const keyIdeas = (row?.keyIdeas as string[]) ?? [];
    if (!keyIdeas.length) return { ok: false, n: 0 };
    const { ideaScore } = await import("@/lib/ai/score");
    const n = await t.saveIdeas(
      ctx.brandId,
      keyIdeas.slice(0, 10).map((title) => ({ title, bucket: "source", sourceId, postScore: ideaScore(title) })),
    );
    return { ok: true, n };
  } catch {
    return { ok: false, n: 0 };
  }
}

/** Soft-delete a source (Vault management). */
export async function deleteSource(sourceId: string): Promise<{ ok: boolean }> {
  try {
    if (!db) return { ok: false };
    const ctx = await currentContext();
    if (!ctx) return { ok: false };
    await forOrg(db, ctx.orgId).deleteSource(ctx.brandId, sourceId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Run (or re-run) AI analysis over one source's chunks and persist the result. */
export async function analyzeSource(sourceId: string): Promise<AnalyzeResult> {
  try {
    const provider = currentProvider();
    if (!hasKeyFor(provider)) return { ok: false, error: "no_key" };
    if (!db) return { ok: false, error: "no_session" };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };

    const t = forOrg(db, ctx.orgId);
    const chunks = await t.sourceChunkTexts(ctx.brandId, sourceId, 40);
    if (!chunks.length) return { ok: false, error: "no_chunks" };

    const estimate = estimateAnalyze();
    if ((await t.balance()) < estimate) return { ok: false, error: "insufficient_credits" };

    const res = await generateText({
      system: ANALYSIS_SYSTEM,
      user: buildAnalysisUserMessage(chunks),
      maxTokens: 4096,
      anthropicModel: process.env.ANTHROPIC_DNA_MODEL || MODELS.SONNET,
      schema: ANALYSIS_SCHEMA,
      provider,
    });
    if (res.truncated) return { ok: false, error: "failed", message: "Output hit the token cap." };

    const analysis = normalizeAnalysis(extractJson<unknown>(res.text));
    await t.saveAnalysis(ctx.brandId, sourceId, {
      summary: analysis.summary,
      keyIdeas: analysis.key_ideas,
      quotes: analysis.quotes,
      audience: analysis.audience_problems,
      opportunities: analysis.content_opportunities,
    });
    await t.debit(estimate, "analyze_source", "source", sourceId);
    return { ok: true, analysis };
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}
