"use server";

import { revalidatePath } from "next/cache";
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
import { IDEAS_SYSTEM, IDEAS_SCHEMA, buildIdeasUserMessage, buildBrandContext, STUDIO_SYSTEM, STUDIO_SCHEMA, buildStudioMessage } from "@/lib/ai/prompts";
import { postScore, dnaMatch } from "@/lib/ai/score";
import { estimateCompose } from "@/lib/credits/costs";

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

    // Phase 1: fold the brand's products + profile into the brief (best-effort).
    let brand: string | undefined;
    try {
      const [profile, products] = await Promise.all([t.getBrandProfile(ctx.brandId), t.listProducts(ctx.brandId)]);
      brand = buildBrandContext({ profile, products }) || undefined;
    } catch {
      /* brand context is best-effort */
    }

    const res = await generateText({
      system: IDEAS_SYSTEM,
      user: buildIdeasUserMessage({ topic: input.topic, dna, sources, count, brand }),
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

/** Batch-generate drafts from selected ideas (Phase 2 #8). For each idea we
 * compose a post in the brand's voice, score + save it as a draft, and mark the
 * idea "used". Capped at 4 per call to stay within the 60s function budget. */
export async function batchGenerate(
  ideaIds: string[],
  opts?: { platform?: string },
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  try {
    const provider = currentProvider();
    if (!hasKeyFor(provider)) return { ok: false, error: "no_key" };
    if (!db) return { ok: false, error: "no_session" };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };

    const ids = Array.from(new Set(ideaIds)).slice(0, 4); // cap keeps the batch under the 60s function limit
    if (!ids.length) return { ok: false, error: "none_selected" };

    const t = forOrg(db, ctx.orgId);
    const dna = await t.currentDna(ctx.brandId);
    if (!dna) return { ok: false, error: "no_dna" };
    if ((await t.balance()) < estimateCompose() * ids.length) return { ok: false, error: "insufficient_credits" };

    // The ideas to write (title/angle become the prompt).
    const all = await t.listIdeas(ctx.brandId, { limit: 100 });
    const chosen = all.filter((i) => ids.includes(i.id));
    if (!chosen.length) return { ok: false, error: "none_selected" };

    let brand: string | undefined;
    try {
      const [profile, products] = await Promise.all([t.getBrandProfile(ctx.brandId), t.listProducts(ctx.brandId)]);
      brand = buildBrandContext({ profile, products }) || undefined;
    } catch {
      /* best-effort */
    }

    const platform = opts?.platform || "linkedin";
    let created = 0;
    for (const idea of chosen) {
      try {
        const prompt = idea.angle ? `${idea.title} — ${idea.angle}` : idea.title;
        const res = await generateText({
          system: STUDIO_SYSTEM,
          user: buildStudioMessage({ dna, prompt, platform, format: "post", tone: "professional", length: "medium", brand }),
          maxTokens: 4096,
          anthropicModel: process.env.ANTHROPIC_DRAFT_MODEL || MODELS.SONNET,
          schema: STUDIO_SCHEMA,
          provider,
        });
        if (res.truncated) continue;
        const parsed = extractJson<{ hooks?: unknown; body?: unknown }>(res.text);
        const hooks = Array.isArray(parsed?.hooks) ? parsed.hooks.map((h) => String(h)).filter(Boolean) : [];
        const body = typeof parsed?.body === "string" ? parsed.body : "";
        if (!hooks.length || !body) continue;
        await t.saveDraft(ctx.brandId, {
          platform,
          topic: idea.title,
          hook: hooks[0],
          body,
          ideaId: idea.id,
          postScore: postScore(hooks[0], body),
          dnaMatch: dnaMatch(`${hooks[0]}\n${body}`, dna),
        });
        await t.setIdeaStatus(ctx.brandId, idea.id, "used");
        await t.debit(estimateCompose(), "batch_compose", "idea", idea.id);
        created++;
      } catch {
        /* skip a failed item, keep going */
      }
    }
    if (!created) return { ok: false, error: "failed" };
    revalidatePath("/ideas");
    return { ok: true, created };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
