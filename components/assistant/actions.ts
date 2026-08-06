"use server";

import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { estimateRewrite } from "@/lib/credits/costs";
import { ASSISTANT_SYSTEM, buildAssistantContext, buildBrandContext } from "@/lib/ai/prompts";

export type ChatMsg = { role: "user" | "assistant"; content: string };

/** Persisted history for the current brand (chronological). */
export async function loadAssistantHistory(): Promise<ChatMsg[]> {
  if (!db) return [];
  const ctx = await currentContext();
  if (!ctx) return [];
  const rows = await forOrg(db, ctx.orgId).listAssistantMessages(ctx.brandId, 40);
  return rows.map((r) => ({ role: r.role === "assistant" ? "assistant" : "user", content: r.content }));
}

export async function clearAssistantHistory(): Promise<{ ok: boolean }> {
  try {
    if (!db) return { ok: false };
    const ctx = await currentContext();
    if (!ctx) return { ok: false };
    await forOrg(db, ctx.orgId).clearAssistant(ctx.brandId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Ask the brand assistant. Folds in the brand's DNA + profile + products, keeps
 * the recent transcript for continuity, persists both turns, returns the reply. */
export async function askAssistant(message: string, history: ChatMsg[]): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  try {
    const provider = currentProvider();
    if (!hasKeyFor(provider)) return { ok: false, error: "no_key" };
    if (!message?.trim()) return { ok: false, error: "empty" };
    if (!db) return { ok: false, error: "no_session" };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };
    const t = forOrg(db, ctx.orgId);
    if ((await t.balance()) < estimateRewrite()) return { ok: false, error: "insufficient_credits" };

    let brandBlock = "";
    try {
      const [dna, profile, products] = await Promise.all([t.currentDna(ctx.brandId), t.getBrandProfile(ctx.brandId), t.listProducts(ctx.brandId)]);
      brandBlock = buildAssistantContext({ dna, brand: buildBrandContext({ profile, products }) });
    } catch {
      /* best-effort */
    }

    // Build a compact transcript for continuity (last ~8 turns) + the new message.
    const recent = history.slice(-8).map((m) => `${m.role === "assistant" ? "المساعد" : "المستخدم"}: ${m.content}`).join("\n");
    const user = [brandBlock, recent ? `المحادثة السابقة:\n${recent}` : "", `المستخدم: ${message.trim()}`, `المساعد:`].filter(Boolean).join("\n\n");

    const res = await generateText({
      system: ASSISTANT_SYSTEM,
      user,
      maxTokens: 1024,
      anthropicModel: process.env.ANTHROPIC_DRAFT_MODEL || MODELS.SONNET,
      provider,
    });
    const reply = res.text.trim();
    if (!reply) return { ok: false, error: "failed" };

    await t.saveAssistantMessages(ctx.brandId, [
      { role: "user", content: message.trim() },
      { role: "assistant", content: reply },
    ]);
    await t.debit(estimateRewrite(), "assistant_chat", "brand", ctx.brandId);
    return { ok: true, reply };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
