"use server";

import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/json";
import { normalizeDna } from "@/lib/ai/normalize";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { estimateDna } from "@/lib/credits/costs";
import { currentContext } from "@/lib/auth/current";
import { DNA_SYSTEM, DNA_SCHEMA, buildDnaUserMessage, type ContentDna } from "@/lib/ai/prompts";

export type OnboardResult =
  | { ok: true; dna: ContentDna; model: string }
  | { ok: false; error: "no_key" | "too_few" | "failed" | "insufficient_credits"; message?: string };

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

  // Pre-flight credit check (ADR-004); resolve context once for debit + persist.
  const estimate = estimateDna();
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
    const dna = normalizeDna(extractJson<unknown>(res.text));
    try {
      if (db && ctx) {
        const t = forOrg(db, ctx.orgId);
        await t.saveDna(ctx.brandId, dna);
        await t.debit(estimate, "onboarding_dna", "brand", ctx.brandId);
      }
    } catch {
      /* best-effort */
    }
    return { ok: true, dna, model: res.model };
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}
