"use server";

import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/json";
import { normalizeDna } from "@/lib/ai/normalize";
import { DNA_SYSTEM, DNA_SCHEMA, buildDnaUserMessage, type ContentDna } from "@/lib/ai/prompts";

export type OnboardResult =
  | { ok: true; dna: ContentDna; model: string }
  | { ok: false; error: "no_key" | "too_few" | "failed"; message?: string };

/** Cold start: build DNA v0 from pasted posts OR interview answers — no upload, no DB. */
export async function onboardToDna(input: { samples: string }): Promise<OnboardResult> {
  const samples = (input.samples ?? "").trim();
  if (samples.length < 150) {
    return { ok: false, error: "too_few" };
  }
  const provider = currentProvider();
  if (!hasKeyFor(provider)) {
    return { ok: false, error: "no_key" };
  }
  const dnaFallback = process.env.ANTHROPIC_DNA_MODEL || MODELS.OPUS;

  try {
    const res = await generateText({
      system: DNA_SYSTEM,
      user: buildDnaUserMessage(samples),
      maxTokens: 4096,
      anthropicModel: dnaFallback,
      schema: DNA_SCHEMA,
      provider,
    });
    if (res.truncated) return { ok: false, error: "failed", message: "Output hit the token cap." };
    return { ok: true, dna: normalizeDna(extractJson<unknown>(res.text)), model: res.model };
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}
