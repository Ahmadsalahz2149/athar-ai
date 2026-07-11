"use server";

import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { isValidSelection, type ProviderId } from "@/lib/ai/catalog";
import { extractJson } from "@/lib/ai/json";
import { normalizeDna, normalizeDrafts, type Draft } from "@/lib/ai/normalize";
import { postScore, dnaMatch } from "@/lib/ai/score";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { estimateStudio } from "@/lib/credits/costs";
import { embedOne, hasEmbeddingKey } from "@/lib/ai/embed";
import { currentContext } from "@/lib/auth/current";
import {
  DNA_SYSTEM,
  DNA_SCHEMA,
  buildDnaUserMessage,
  DRAFT_SYSTEM,
  DRAFTS_SCHEMA,
  buildDraftUserMessage,
  DNA_PROMPT_ID,
  DNA_PROMPT_VERSION,
  DRAFT_PROMPT_ID,
  DRAFT_PROMPT_VERSION,
  type ContentDna,
} from "@/lib/ai/prompts";

export type GenerateInput = {
  posts: string;
  topic: string;
  platform: string;
  count?: number;
  /** UI-chosen provider + model (validated server-side). */
  provider?: string;
  model?: string;
};

export type GenerateResult =
  | {
      ok: true;
      dna: ContentDna;
      drafts: (Draft & { id?: string; postScore: number; dnaMatch: number })[];
      meta: {
        dnaModel: string;
        draftModel: string;
        dnaPrompt: string;
        draftPrompt: string;
        cost: number;
        grounded: boolean;
      };
    }
  | {
      ok: false;
      error: "no_key" | "too_few_posts" | "truncated" | "failed" | "insufficient_credits";
      message?: string;
    };

/** Submit a persisted draft into the Approvals queue (status → pending). */
export async function submitForApproval(draftId: string): Promise<{ ok: boolean }> {
  try {
    if (!db) return { ok: false };
    const ctx = await currentContext();
    if (!ctx) return { ok: false };
    await forOrg(db, ctx.orgId).setDraftStatus(ctx.brandId, draftId, "pending");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function generateStudio(input: GenerateInput): Promise<GenerateResult> {
  const posts = (input.posts ?? "").trim();
  const paragraphs = posts.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length < 3 && posts.length < 200) {
    return { ok: false, error: "too_few_posts" };
  }

  // Resolve provider/model: use the UI selection if valid, else env defaults.
  let provider: ProviderId = currentProvider();
  let model: string | undefined;
  if (input.provider && input.model && isValidSelection(input.provider, input.model)) {
    provider = input.provider as ProviderId;
    model = input.model;
  }
  if (!hasKeyFor(provider)) {
    return { ok: false, error: "no_key" };
  }

  const count = Math.min(Math.max(input.count ?? 3, 1), 5);

  // Pre-flight credit check (ADR-004): estimate cost, refuse if the org can't
  // cover it. Resolve the tenant context once; reuse it for debit + persistence.
  const estimate = estimateStudio(count);
  let ctx: Awaited<ReturnType<typeof currentContext>> = null;
  if (db) {
    ctx = await currentContext();
    if (ctx) {
      const bal = await forOrg(db, ctx.orgId).balance();
      if (bal < estimate) {
        return { ok: false, error: "insufficient_credits", message: `${bal}/${estimate}` };
      }
    }
  }

  // Anthropic fallback tiers (used only when no explicit model is chosen).
  const dnaFallback = process.env.ANTHROPIC_DNA_MODEL || MODELS.OPUS;
  const draftFallback = process.env.ANTHROPIC_DRAFT_MODEL || MODELS.SONNET;

  try {
    // 1) Content DNA.
    const dnaRes = await generateText({
      system: DNA_SYSTEM,
      user: buildDnaUserMessage(posts),
      maxTokens: 4096,
      anthropicModel: dnaFallback,
      schema: DNA_SCHEMA,
      provider,
      model,
    });
    if (dnaRes.truncated) return { ok: false, error: "truncated", message: "DNA output hit the token cap." };
    const dna = normalizeDna(extractJson<unknown>(dnaRes.text));

    // 1.5) Retrieval grounding: if the brand has ingested sources, pull the
    // chunks most relevant to the topic and feed them as <SOURCE> data so drafts
    // draw on the person's real material (best-effort — never breaks generation).
    const queryText = input.topic?.trim() || dna.summary;
    let sourceContext: string | undefined;
    if (db && ctx && hasEmbeddingKey()) {
      try {
        const t = forOrg(db, ctx.orgId);
        if ((await t.countChunks(ctx.brandId)) > 0) {
          const qv = await embedOne(queryText, "query");
          const hits = await t.retrieve(ctx.brandId, qv, 6);
          if (hits.length) sourceContext = hits.map((h, i) => `[${i + 1}] ${h.content}`).join("\n\n");
        }
      } catch {
        /* grounding is best-effort */
      }
    }

    // 2) Drafts.
    const draftRes = await generateText({
      system: DRAFT_SYSTEM,
      user: buildDraftUserMessage({
        dna,
        topic: queryText,
        platform: input.platform,
        count,
        source: sourceContext,
      }),
      maxTokens: 8192,
      anthropicModel: draftFallback,
      schema: DRAFTS_SCHEMA,
      provider,
      model,
    });
    if (draftRes.truncated) return { ok: false, error: "truncated", message: "Drafts output hit the token cap." };
    const raw = normalizeDrafts(extractJson<unknown>(draftRes.text));

    if (raw.length === 0) {
      return { ok: false, error: "failed", message: "No drafts were parsed from the model response." };
    }

    // Deterministic, explainable scores (Post Score + DNA Match).
    const drafts: (Draft & { id?: string; postScore: number; dnaMatch: number })[] = raw.map((d) => ({
      ...d,
      postScore: postScore(d.hook, d.body),
      dnaMatch: dnaMatch(`${d.hook}\n${d.body}`, dna),
    }));

    // Persist + debit (best-effort) — never break generation. Debit only after a
    // successful generation, so a failed run never charges the user.
    try {
      if (db && ctx) {
        const t = forOrg(db, ctx.orgId);
        const dnaVersionId = await t.saveDna(ctx.brandId, dna);
        for (const d of drafts) {
          d.id = await t.saveDraft(ctx.brandId, {
            platform: input.platform,
            topic: input.topic,
            hook: d.hook,
            body: d.body,
            dnaVersionId,
            postScore: d.postScore,
            dnaMatch: d.dnaMatch,
          });
        }
        await t.debit(estimate, "studio_generation", "brand", ctx.brandId);
      }
    } catch {
      /* persistence is best-effort */
    }

    return {
      ok: true,
      dna,
      drafts,
      meta: {
        dnaModel: dnaRes.model,
        draftModel: draftRes.model,
        dnaPrompt: `${DNA_PROMPT_ID}@${DNA_PROMPT_VERSION}`,
        draftPrompt: `${DRAFT_PROMPT_ID}@${DRAFT_PROMPT_VERSION}`,
        cost: estimate,
        grounded: !!sourceContext,
      },
    };
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}
