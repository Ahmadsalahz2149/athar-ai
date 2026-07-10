"use server";

import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { isValidSelection, type ProviderId } from "@/lib/ai/catalog";
import { extractJson } from "@/lib/ai/json";
import { normalizeDna, normalizeDrafts, type Draft } from "@/lib/ai/normalize";
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

export type { Draft };

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
      drafts: Draft[];
      meta: { dnaModel: string; draftModel: string; dnaPrompt: string; draftPrompt: string };
    }
  | { ok: false; error: "no_key" | "too_few_posts" | "truncated" | "failed"; message?: string };

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

    // 2) Drafts.
    const count = Math.min(Math.max(input.count ?? 3, 1), 5);
    const draftRes = await generateText({
      system: DRAFT_SYSTEM,
      user: buildDraftUserMessage({
        dna,
        topic: input.topic?.trim() || dna.summary,
        platform: input.platform,
        count,
      }),
      maxTokens: 8192,
      anthropicModel: draftFallback,
      schema: DRAFTS_SCHEMA,
      provider,
      model,
    });
    if (draftRes.truncated) return { ok: false, error: "truncated", message: "Drafts output hit the token cap." };
    const drafts = normalizeDrafts(extractJson<unknown>(draftRes.text));

    if (drafts.length === 0) {
      return { ok: false, error: "failed", message: "No drafts were parsed from the model response." };
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
      },
    };
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}
