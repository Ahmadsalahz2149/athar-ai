"use server";

import { getAnthropic, hasAnthropicKey } from "@/lib/ai/anthropic";
import { MODELS } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/json";
import {
  DNA_SYSTEM,
  buildDnaUserMessage,
  DRAFT_SYSTEM,
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
  | { ok: false; error: "no_key" | "too_few_posts" | "failed"; message?: string };

type TextyBlock = { type: string; text?: string };

function textOf(msg: { content: TextyBlock[] }): string {
  return msg.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}

export async function generateStudio(input: GenerateInput): Promise<GenerateResult> {
  const posts = (input.posts ?? "").trim();
  const paragraphs = posts.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length < 3 && posts.length < 200) {
    return { ok: false, error: "too_few_posts" };
  }
  if (!hasAnthropicKey()) {
    return { ok: false, error: "no_key" };
  }

  try {
    const client = getAnthropic();

    // 1) Content DNA — Opus (synthesis). No tools; source passed as delimited data.
    const dnaMsg = await client.messages.create({
      model: MODELS.OPUS,
      max_tokens: 2048,
      system: DNA_SYSTEM,
      messages: [{ role: "user", content: buildDnaUserMessage(posts) }],
    });
    const dna = extractJson<ContentDna>(textOf(dnaMsg));

    // 2) Drafts — Sonnet (workhorse).
    const count = Math.min(Math.max(input.count ?? 3, 1), 5);
    const draftMsg = await client.messages.create({
      model: MODELS.SONNET,
      max_tokens: 3072,
      system: DRAFT_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildDraftUserMessage({
            dna,
            topic: input.topic?.trim() || dna.summary,
            platform: input.platform,
            count,
          }),
        },
      ],
    });
    const parsed = extractJson<{ drafts: Draft[] }>(textOf(draftMsg));

    return {
      ok: true,
      dna,
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
      meta: {
        dnaModel: MODELS.OPUS,
        draftModel: MODELS.SONNET,
        dnaPrompt: `${DNA_PROMPT_ID}@${DNA_PROMPT_VERSION}`,
        draftPrompt: `${DRAFT_PROMPT_ID}@${DRAFT_PROMPT_VERSION}`,
      },
    };
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}
