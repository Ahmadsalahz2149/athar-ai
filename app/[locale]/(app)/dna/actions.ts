"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { normalizeDna } from "@/lib/ai/normalize";
import type { ContentDna } from "@/lib/ai/prompts";

/** The subset of DNA the user can edit by hand. Everything else is carried over
 * from the current version; saving creates a NEW version (history is preserved). */
export type DnaEdits = {
  tone_traits: string[];
  dialect: string;
  explanation_style: string;
  dos: string[];
  donts: string[];
  hook_patterns: string[];
  cta_patterns: string[];
  pillars: ContentDna["pillars"];
};

export type TraitItem = { category: string; trait: string; sourceId: string | null; sourceTitle: string | null; snippet: string | null; strong: boolean };
export type TraitProvenance =
  | { ok: true; items: TraitItem[] }
  | { ok: false; reason: "no_key" | "no_sources" | "no_session" | "no_dna" };

/** Attribute each DNA trait to its closest source, semantically. For every trait
 * (tone/hooks/CTAs/dos/donts) we embed the phrase and find the nearest source
 * chunk via retrieve(). Honest framing: "closest source", not exact derivation —
 * `strong` flags a confident match (small cosine distance). One batched embed
 * call, so it stays within rate limits. */
export async function traitProvenance(): Promise<TraitProvenance> {
  const { hasEmbeddingKey, embed } = await import("@/lib/ai/embed");
  if (!hasEmbeddingKey()) return { ok: false, reason: "no_key" };
  if (!db) return { ok: false, reason: "no_session" };
  const ctx = await currentContext();
  if (!ctx) return { ok: false, reason: "no_session" };

  const t = forOrg(db, ctx.orgId);
  const dna = await t.currentDna(ctx.brandId);
  if (!dna) return { ok: false, reason: "no_dna" };
  if ((await t.countChunks(ctx.brandId)) === 0) return { ok: false, reason: "no_sources" };

  // Collect labelled traits (capped so the embed batch stays small).
  const collected: { category: string; trait: string }[] = [];
  const push = (category: string, xs: string[]) => xs.filter(Boolean).forEach((trait) => collected.push({ category, trait }));
  push("tone", dna.tone_traits);
  push("hook", dna.hook_patterns);
  push("cta", dna.cta_patterns);
  push("do", dna.dos);
  push("dont", dna.donts);
  const traits = collected.slice(0, 24);
  if (!traits.length) return { ok: true, items: [] };

  const vectors = await embed(traits.map((x) => x.trait), "query");
  const titleCache = new Map<string, string | null>();
  const items: TraitItem[] = [];
  for (let i = 0; i < traits.length; i++) {
    const hits = await t.retrieve(ctx.brandId, vectors[i], 1, traits[i].trait);
    const hit = hits[0];
    if (!hit) { items.push({ ...traits[i], sourceId: null, sourceTitle: null, snippet: null, strong: false }); continue; }
    if (!titleCache.has(hit.sourceId)) {
      const src = await t.getSource(ctx.brandId, hit.sourceId);
      titleCache.set(hit.sourceId, src?.title ?? null);
    }
    const snippet = hit.content.replace(/\s+/g, " ").trim().slice(0, 140);
    items.push({ ...traits[i], sourceId: hit.sourceId, sourceTitle: titleCache.get(hit.sourceId) ?? null, snippet, strong: hit.distance < 0.55 });
  }
  return { ok: true, items };
}

export async function saveDnaEdits(edits: DnaEdits): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!db) return { ok: false, error: "no_session" };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };

    const t = forOrg(db, ctx.orgId);
    const current = await t.currentDna(ctx.brandId);
    if (!current) return { ok: false, error: "no_dna" };

    const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean).slice(0, 12);
    const merged = normalizeDna({
      ...current,
      tone_traits: clean(edits.tone_traits),
      dialect: edits.dialect.trim(),
      explanation_style: edits.explanation_style.trim(),
      dos: clean(edits.dos),
      donts: clean(edits.donts),
      hook_patterns: clean(edits.hook_patterns),
      cta_patterns: clean(edits.cta_patterns),
      pillars: edits.pillars,
    });

    await t.saveDna(ctx.brandId, merged);
    revalidatePath("/[locale]/(app)/dna", "page");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}

/** Voice test (DNA page): AI critique of how on-brand a piece of text is. */
export async function voiceFeedback(text: string): Promise<
  { ok: true; matches: string[]; breaks: string[]; tip: string } | { ok: false; error: string }
> {
  try {
    const { generateText, hasKeyFor, currentProvider } = await import("@/lib/ai/generate");
    const { extractJson } = await import("@/lib/ai/json");
    const { MODELS } = await import("@/lib/ai/models");
    const { VOICE_TEST_SYSTEM, VOICE_TEST_SCHEMA, buildVoiceTestMessage } = await import("@/lib/ai/prompts");
    const { estimateRewrite } = await import("@/lib/credits/costs");
    const provider = currentProvider();
    if (!hasKeyFor(provider)) return { ok: false, error: "no_key" };
    if (!text?.trim() || text.trim().length < 10) return { ok: false, error: "empty" };
    if (!db) return { ok: false, error: "no_session" };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };
    const t = forOrg(db, ctx.orgId);
    const dna = await t.currentDna(ctx.brandId);
    if (!dna) return { ok: false, error: "no_dna" };
    if ((await t.balance()) < estimateRewrite()) return { ok: false, error: "insufficient_credits" };
    const res = await generateText({
      system: VOICE_TEST_SYSTEM,
      user: buildVoiceTestMessage({ text, dna }),
      maxTokens: 800,
      anthropicModel: process.env.ANTHROPIC_DRAFT_MODEL || MODELS.HAIKU,
      schema: VOICE_TEST_SCHEMA,
      provider,
    });
    const parsed = extractJson<{ matches?: unknown; breaks?: unknown; tip?: unknown }>(res.text);
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 5) : []);
    await t.debit(estimateRewrite(), "voice_test", "brand", ctx.brandId);
    return { ok: true, matches: arr(parsed?.matches), breaks: arr(parsed?.breaks), tip: typeof parsed?.tip === "string" ? parsed.tip : "" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
