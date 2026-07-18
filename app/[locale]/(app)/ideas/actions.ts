"use server";

import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/json";
import { normalizeIdeas } from "@/lib/ai/normalize";
import { ideaScore } from "@/lib/ai/score";
import { embedOne, hasEmbeddingKey } from "@/lib/ai/embed";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { estimateIdeas } from "@/lib/credits/costs";
import { IDEAS_SYSTEM, IDEAS_SCHEMA, buildIdeasUserMessage } from "@/lib/ai/prompts";

export type IdeasResult =
  | { ok: true; count: number }
  | {
      ok: false;
      error: "no_key" | "no_session" | "no_dna" | "insufficient_credits" | "failed";
      message?: string;
    };

export async function generateIdeas(input: { topic?: string; count?: number }): Promise<IdeasResult> {
  try {
    const provider = currentProvider();
    if (!hasKeyFor(provider)) return { ok: false, error: "no_key" };
    if (!db) return { ok: false, error: "no_session" };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };

    const t = forOrg(db, ctx.orgId);
    const dna = await t.currentDna(ctx.brandId);
    if (!dna) return { ok: false, error: "no_dna" };

    const count = Math.min(Math.max(input.count ?? 6, 3), 10);
    const estimate = estimateIdeas(count);
    if ((await t.balance()) < estimate) return { ok: false, error: "insufficient_credits" };

    let sources: string | undefined;
    if (hasEmbeddingKey() && (await t.countChunks(ctx.brandId)) > 0) {
      const qv = await embedOne(input.topic?.trim() || dna.summary, "query");
      const hits = await t.retrieve(ctx.brandId, qv, 5);
      if (hits.length) sources = hits.map((h, i) => `[${i + 1}] ${h.content}`).join("\n\n");
    }

    const res = await generateText({
      system: IDEAS_SYSTEM,
      user: buildIdeasUserMessage({ topic: input.topic, dna, sources, count }),
      maxTokens: 2048,
      anthropicModel: process.env.ANTHROPIC_DRAFT_MODEL || MODELS.HAIKU,
      schema: IDEAS_SCHEMA,
      provider,
    });
    if (res.truncated) return { ok: false, error: "failed", message: "Output hit the token cap." };

    const ideas = normalizeIdeas(extractJson<unknown>(res.text));
    if (!ideas.length) return { ok: false, error: "failed", message: "No ideas parsed." };

    const saved = await t.saveIdeas(
      ctx.brandId,
      ideas.map((i) => ({
        title: i.title,
        angle: i.angle,
        category: i.category,
        bucket: input.topic ? "suggested" : "source",
        postScore: ideaScore(i.title),
      })),
    );
    await t.debit(estimate, "generate_ideas", "brand", ctx.brandId);
    return { ok: true, count: saved };
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}

export async function toggleSaveIdea(ideaId: string, save: boolean): Promise<{ ok: boolean }> {
  try {
    if (!db) return { ok: false };
    const ctx = await currentContext();
    if (!ctx) return { ok: false };
    await forOrg(db, ctx.orgId).setIdeaStatus(ctx.brandId, ideaId, save ? "saved" : "new");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Mark an idea "used" when the user opens it in the Studio (idea→post lineage). */
export async function markIdeaUsed(ideaId: string): Promise<{ ok: boolean }> {
  try {
    if (!db) return { ok: false };
    const ctx = await currentContext();
    if (!ctx) return { ok: false };
    await forOrg(db, ctx.orgId).setIdeaStatus(ctx.brandId, ideaId, "used");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
