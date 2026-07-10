"use server";

import { generateText, hasProviderKey } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/json";
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

export type Draft = { hook: string; body: string };

export type GenerateInput = {
  posts: string;
  topic: string;
  platform: string;
  count?: number;
};

export type GenerateResult =
  | {
      ok: true;
      dna: ContentDna;
      drafts: Draft[];
      meta: { dnaModel: string; draftModel: string; dnaPrompt: string; draftPrompt: string };
    }
  | { ok: false; error: "no_key" | "too_few_posts" | "truncated" | "failed"; message?: string };

/** Coerce any model output into a well-formed DNA — missing fields never crash the UI. */
function normalizeDna(raw: unknown): ContentDna {
  const o = (raw ?? {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
  const pct = Number(o.completion_pct);
  return {
    summary: typeof o.summary === "string" ? o.summary : "",
    dialect: typeof o.dialect === "string" ? o.dialect : "",
    tone_traits: arr(o.tone_traits),
    hook_patterns: arr(o.hook_patterns),
    audience: typeof o.audience === "string" ? o.audience : "",
    dos: arr(o.dos),
    donts: arr(o.donts),
    completion_pct: Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.round(pct))) : 0,
  };
}

function normalizeDrafts(raw: unknown): Draft[] {
  const o = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(o.drafts) ? o.drafts : [];
  return list
    .map((d) => {
      const x = (d ?? {}) as Record<string, unknown>;
      return {
        hook: typeof x.hook === "string" ? x.hook : "",
        body: typeof x.body === "string" ? x.body : "",
      };
    })
    .filter((d) => d.hook.trim() || d.body.trim());
}

export async function generateStudio(input: GenerateInput): Promise<GenerateResult> {
  const posts = (input.posts ?? "").trim();
  const paragraphs = posts.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length < 3 && posts.length < 200) {
    return { ok: false, error: "too_few_posts" };
  }
  if (!hasProviderKey()) {
    return { ok: false, error: "no_key" };
  }

  try {
    // 1) Content DNA — Opus on Anthropic (structured output); MiniMax model otherwise.
    const dnaRes = await generateText({
      system: DNA_SYSTEM,
      user: buildDnaUserMessage(posts),
      maxTokens: 4096,
      anthropicModel: MODELS.OPUS,
      schema: DNA_SCHEMA,
    });
    if (dnaRes.truncated) return { ok: false, error: "truncated", message: "DNA output hit the token cap." };
    const dna = normalizeDna(extractJson<unknown>(dnaRes.text));

    // 2) Drafts — Sonnet on Anthropic; MiniMax model otherwise. Generous cap.
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
      anthropicModel: MODELS.SONNET,
      schema: DRAFTS_SCHEMA,
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
