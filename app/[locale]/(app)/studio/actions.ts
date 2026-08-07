"use server";

import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { isValidSelection, type ProviderId } from "@/lib/ai/catalog";
import { extractJson } from "@/lib/ai/json";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { estimateCompose, estimateRewrite } from "@/lib/credits/costs";
import { embedOne, hasEmbeddingKey } from "@/lib/ai/embed";
import { postScore, dnaMatch } from "@/lib/ai/score";
import { currentContext } from "@/lib/auth/current";
import {
  STUDIO_SYSTEM,
  STUDIO_SCHEMA,
  buildStudioMessage,
  REWRITE_SYSTEM,
  REWRITE_SCHEMA,
  buildRewriteMessage,
  STUDIO_PROMPT_ID,
  STUDIO_PROMPT_VERSION,
  buildBrandContext,
  HASHTAG_SYSTEM,
  HASHTAG_SCHEMA,
  buildHashtagMessage,
  TRANSLATE_SYSTEM,
  TRANSLATE_SCHEMA,
  buildTranslateMessage,
  type ContentDna,
} from "@/lib/ai/prompts";

export type StudioSource = { id: string; title: string; label: string };

export type StudioInput = {
  prompt: string;
  platform: string;
  format: string;
  tone: string;
  length: string;
  sourceId?: string;
  provider?: string;
  model?: string;
};

export type StudioResult =
  | {
      ok: true;
      id?: string;
      dna: ContentDna;
      hooks: string[];
      body: string;
      postScore: number;
      dnaMatch: number;
      bestTime: string;
      grounded: boolean;
      meta: { model: string; prompt: string; cost: number };
    }
  | {
      ok: false;
      error: "no_key" | "no_dna" | "insufficient_credits" | "truncated" | "failed";
      message?: string;
    };

function resolveProvider(input: { provider?: string; model?: string }): { provider: ProviderId; model?: string } {
  let provider: ProviderId = currentProvider();
  let model: string | undefined;
  if (input.provider && input.model && isValidSelection(input.provider, input.model)) {
    provider = input.provider as ProviderId;
    model = input.model;
  }
  return { provider, model };
}

const BEST_TIME = "الأحد ٩:٠٠ ص";

export async function studioGenerate(input: StudioInput): Promise<StudioResult> {
  const { provider, model } = resolveProvider(input);
  if (!hasKeyFor(provider)) return { ok: false, error: "no_key" };
  if (!db) return { ok: false, error: "no_dna" };
  const ctx = await currentContext();
  if (!ctx) return { ok: false, error: "no_dna" };

  const t = forOrg(db, ctx.orgId);
  const dna = await t.currentDna(ctx.brandId);
  if (!dna) return { ok: false, error: "no_dna" };

  const estimate = estimateCompose();
  if ((await t.balance()) < estimate) return { ok: false, error: "insufficient_credits" };

  try {
    // Grounding: from the chosen source's chunks, else RAG on the prompt.
    let source: string | undefined;
    if (hasEmbeddingKey()) {
      try {
        if (input.sourceId) {
          const texts = await t.sourceChunkTexts(ctx.brandId, input.sourceId, 6);
          if (texts.length) source = texts.map((c, i) => `[${i + 1}] ${c}`).join("\n\n");
        } else if (input.prompt.trim() && (await t.countChunks(ctx.brandId)) > 0) {
          const qv = await embedOne(input.prompt.trim(), "query");
          const hits = await t.retrieve(ctx.brandId, qv, 5);
          if (hits.length) source = hits.map((h, i) => `[${i + 1}] ${h.content}`).join("\n\n");
        }
      } catch {
        /* grounding is best-effort */
      }
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
      system: STUDIO_SYSTEM,
      user: buildStudioMessage({
        dna,
        prompt: input.prompt.trim() || dna.summary,
        platform: input.platform,
        format: input.format,
        tone: input.tone,
        length: input.length,
        source,
        brand,
      }),
      maxTokens: 4096,
      anthropicModel: process.env.ANTHROPIC_DRAFT_MODEL || MODELS.SONNET,
      schema: STUDIO_SCHEMA,
      provider,
      model,
    });
    if (res.truncated) return { ok: false, error: "truncated", message: "Output hit the token cap." };

    const parsed = extractJson<{ hooks?: unknown; body?: unknown }>(res.text);
    const hooks = Array.isArray(parsed?.hooks) ? parsed.hooks.map((h) => String(h)).filter(Boolean).slice(0, 3) : [];
    const body = typeof parsed?.body === "string" ? parsed.body : "";
    if (!hooks.length || !body) return { ok: false, error: "failed", message: "No draft parsed." };
    while (hooks.length < 3) hooks.push(hooks[hooks.length - 1]);

    const ps = postScore(hooks[0], body);
    const dm = dnaMatch(`${hooks[0]}\n${body}`, dna);

    let id: string | undefined;
    try {
      id = await t.saveDraft(ctx.brandId, {
        platform: input.platform,
        topic: input.prompt,
        hook: hooks[0],
        body,
        postScore: ps,
        dnaMatch: dm,
      });
      if (input.sourceId) await t.setDraftSource(ctx.brandId, id, input.sourceId);
      await t.debit(estimate, "studio_compose", "brand", ctx.brandId);
    } catch {
      /* persistence best-effort */
    }

    return {
      ok: true,
      id,
      dna,
      hooks,
      body,
      postScore: ps,
      dnaMatch: dm,
      bestTime: BEST_TIME,
      grounded: !!source,
      meta: { model: res.model, prompt: `${STUDIO_PROMPT_ID}@${STUDIO_PROMPT_VERSION}`, cost: estimate },
    };
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}

export type RewriteResult = { ok: true; body: string } | { ok: false; error: string };

export async function studioRewrite(input: { body: string; tool: string; provider?: string; model?: string }): Promise<RewriteResult> {
  const { provider, model } = resolveProvider(input);
  if (!hasKeyFor(provider)) return { ok: false, error: "no_key" };
  if (!db) return { ok: false, error: "no_dna" };
  const ctx = await currentContext();
  if (!ctx) return { ok: false, error: "no_dna" };
  const t = forOrg(db, ctx.orgId);
  const dna = await t.currentDna(ctx.brandId);
  if (!dna) return { ok: false, error: "no_dna" };
  const estimate = estimateRewrite();
  if ((await t.balance()) < estimate) return { ok: false, error: "insufficient_credits" };
  try {
    const res = await generateText({
      system: REWRITE_SYSTEM,
      user: buildRewriteMessage({ body: input.body, tool: input.tool, dna }),
      maxTokens: 3072,
      anthropicModel: process.env.ANTHROPIC_DRAFT_MODEL || MODELS.HAIKU,
      schema: REWRITE_SCHEMA,
      provider,
      model,
    });
    if (res.truncated) return { ok: false, error: "truncated" };
    const parsed = extractJson<{ body?: unknown }>(res.text);
    const body = typeof parsed?.body === "string" ? parsed.body : "";
    if (!body) return { ok: false, error: "failed" };
    await t.debit(estimate, "studio_rewrite", "brand", ctx.brandId);
    return { ok: true, body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Header actions: save / schedule / submit — all operate on a persisted draft. */
export async function setDraftState(
  draftId: string,
  state: "draft" | "pending" | "scheduled",
): Promise<{ ok: boolean }> {
  try {
    if (!db) return { ok: false };
    const ctx = await currentContext();
    if (!ctx) return { ok: false };
    await forOrg(db, ctx.orgId).setDraftStatus(ctx.brandId, draftId, state, state === "scheduled" ? new Date() : undefined);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function submitForApproval(draftId: string): Promise<{ ok: boolean }> {
  return setDraftState(draftId, "pending");
}

export type TranslateResult = { ok: true; hook: string; body: string } | { ok: false; error: string };

/** Produce a voice-preserving translation of the current post to the other
 * language (bilingual content). Not literal — idioms are localized. */
export async function translatePost(input: { hook: string; body: string; target: "ar" | "en"; provider?: string; model?: string }): Promise<TranslateResult> {
  const { provider, model } = resolveProvider(input);
  if (!hasKeyFor(provider)) return { ok: false, error: "no_key" };
  if (!input.body || input.body.trim().length < 10) return { ok: false, error: "too_short" };
  if (!db) return { ok: false, error: "no_dna" };
  const ctx = await currentContext();
  if (!ctx) return { ok: false, error: "no_dna" };
  const t = forOrg(db, ctx.orgId);
  const dna = await t.currentDna(ctx.brandId);
  if (!dna) return { ok: false, error: "no_dna" };
  const estimate = estimateRewrite();
  if ((await t.balance()) < estimate) return { ok: false, error: "insufficient_credits" };
  try {
    const res = await generateText({
      system: TRANSLATE_SYSTEM,
      user: buildTranslateMessage({ hook: input.hook, body: input.body, target: input.target, dna }),
      maxTokens: 3072,
      anthropicModel: process.env.ANTHROPIC_DRAFT_MODEL || MODELS.SONNET,
      schema: TRANSLATE_SCHEMA,
      provider,
      model,
    });
    if (res.truncated) return { ok: false, error: "truncated" };
    const parsed = extractJson<{ hook?: unknown; body?: unknown }>(res.text);
    const hook = typeof parsed?.hook === "string" ? parsed.hook : "";
    const body = typeof parsed?.body === "string" ? parsed.body : "";
    if (!body) return { ok: false, error: "failed" };
    await t.debit(estimate, "studio_translate", "brand", ctx.brandId);
    return { ok: true, hook, body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type HashtagResult = { ok: true; hashtags: string[] } | { ok: false; error: string };

/** Suggest on-topic, Gulf-aware hashtags for the current post body. */
export async function suggestHashtags(input: { body: string; provider?: string; model?: string }): Promise<HashtagResult> {
  const { provider, model } = resolveProvider(input);
  if (!hasKeyFor(provider)) return { ok: false, error: "no_key" };
  if (!input.body || input.body.trim().length < 20) return { ok: false, error: "too_short" };
  if (!db) return { ok: false, error: "failed" };
  const ctx = await currentContext();
  if (!ctx) return { ok: false, error: "failed" };
  const t = forOrg(db, ctx.orgId);
  const estimate = estimateRewrite();
  if ((await t.balance()) < estimate) return { ok: false, error: "insufficient_credits" };
  try {
    const res = await generateText({
      system: HASHTAG_SYSTEM,
      user: buildHashtagMessage(input.body),
      maxTokens: 512,
      anthropicModel: process.env.ANTHROPIC_DRAFT_MODEL || MODELS.HAIKU,
      schema: HASHTAG_SCHEMA,
      provider,
      model,
    });
    if (res.truncated) return { ok: false, error: "failed" };
    const parsed = extractJson<{ hashtags?: unknown }>(res.text);
    const raw = Array.isArray(parsed?.hashtags) ? parsed.hashtags : [];
    const hashtags = raw
      .filter((h): h is string => typeof h === "string")
      .map((h) => "#" + h.trim().replace(/^#+/, "").replace(/\s+/g, "_"))
      .filter((h) => h.length > 1)
      .slice(0, 8);
    if (hashtags.length === 0) return { ok: false, error: "failed" };
    await t.debit(estimate, "studio_hashtags", "brand", ctx.brandId);
    return { ok: true, hashtags };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
