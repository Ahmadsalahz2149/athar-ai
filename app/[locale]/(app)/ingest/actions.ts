"use server";

import { embed, hasEmbeddingKey } from "@/lib/ai/embed";
import { chunkArabic } from "@/lib/ai/chunk";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { estimateIngest } from "@/lib/credits/costs";

export type IngestResult =
  | { ok: true; chunks: number; totalChunks: number; cost: number }
  | {
      ok: false;
      error: "too_few" | "no_embed_key" | "no_session" | "insufficient_credits" | "failed";
      message?: string;
    };

/** Ingest pasted text: chunk (Arabic-aware) → embed (Voyage) → store as a source
 * with per-chunk vectors, scoped to the signed-in user's brand. */
export async function ingestText(input: { title?: string; text: string }): Promise<IngestResult> {
  const text = (input.text ?? "").trim();
  if (text.length < 150) return { ok: false, error: "too_few" };
  if (!hasEmbeddingKey()) return { ok: false, error: "no_embed_key" };
  if (!db) return { ok: false, error: "no_session" };

  const ctx = await currentContext();
  if (!ctx) return { ok: false, error: "no_session" };

  const t = forOrg(db, ctx.orgId);
  const estimate = estimateIngest();
  if ((await t.balance()) < estimate) {
    return { ok: false, error: "insufficient_credits" };
  }

  try {
    const chunks = chunkArabic(text);
    if (!chunks.length) return { ok: false, error: "too_few" };
    const vectors = await embed(chunks.map((c) => c.content), "document");
    const sourceId = await t.saveSource(ctx.brandId, {
      kind: "text",
      title: input.title?.trim() || null,
    });
    await t.saveChunks(
      ctx.brandId,
      sourceId,
      chunks.map((c, i) => ({ idx: c.idx, content: c.content, embedding: vectors[i] })),
    );
    await t.debit(estimate, "ingest_text", "source", sourceId);
    const totalChunks = await t.countChunks(ctx.brandId);
    return { ok: true, chunks: chunks.length, totalChunks, cost: estimate };
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}
