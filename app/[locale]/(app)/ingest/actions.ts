"use server";

import { embed, hasEmbeddingKey } from "@/lib/ai/embed";
import { transcribeAudio, hasTranscribeKey } from "@/lib/ai/transcribe";
import { chunkArabic } from "@/lib/ai/chunk";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { estimateIngest, estimateTranscribe } from "@/lib/credits/costs";

export type IngestResult =
  | { ok: true; chunks: number; totalChunks: number; cost: number }
  | {
      ok: false;
      error:
        | "too_few"
        | "no_embed_key"
        | "no_transcribe_key"
        | "no_session"
        | "insufficient_credits"
        | "unsupported"
        | "too_big"
        | "empty"
        | "failed";
      message?: string;
    };

const MAX_FILE_BYTES = 30 * 1024 * 1024; // matches next.config serverActions.bodySizeLimit

/** Shared tail: chunk -> embed -> store as a source -> debit -> return counts. */
async function storeText(
  orgId: string,
  brandId: string,
  text: string,
  meta: { kind: string; title: string | null; cost: number; reason: string },
): Promise<IngestResult> {
  if (!hasEmbeddingKey()) return { ok: false, error: "no_embed_key" };
  const t = forOrg(db!, orgId);
  const chunks = chunkArabic(text);
  if (!chunks.length) return { ok: false, error: "empty" };
  const vectors = await embed(chunks.map((c) => c.content), "document");
  const sourceId = await t.saveSource(brandId, { kind: meta.kind, title: meta.title });
  await t.saveChunks(
    brandId,
    sourceId,
    chunks.map((c, i) => ({ idx: c.idx, content: c.content, embedding: vectors[i] })),
  );
  await t.debit(meta.cost, meta.reason, "source", sourceId);
  const totalChunks = await t.countChunks(brandId);
  return { ok: true, chunks: chunks.length, totalChunks, cost: meta.cost };
}

/** Ingest pasted text: chunk (Arabic-aware) → embed (Voyage) → store as a source
 * with per-chunk vectors, scoped to the signed-in user's brand. */
export async function ingestText(input: { title?: string; text: string }): Promise<IngestResult> {
  const text = (input.text ?? "").trim();
  if (text.length < 150) return { ok: false, error: "too_few" };
  if (!hasEmbeddingKey()) return { ok: false, error: "no_embed_key" };
  if (!db) return { ok: false, error: "no_session" };

  const ctx = await currentContext();
  if (!ctx) return { ok: false, error: "no_session" };

  const estimate = estimateIngest();
  if ((await forOrg(db, ctx.orgId).balance()) < estimate) {
    return { ok: false, error: "insufficient_credits" };
  }

  try {
    return await storeText(ctx.orgId, ctx.brandId, text, {
      kind: "text",
      title: input.title?.trim() || null,
      cost: estimate,
      reason: "ingest_text",
    });
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Ingest an uploaded file: audio/video → ElevenLabs transcription; text files →
 * read directly. Then the shared chunk→embed→store tail. */
export async function ingestFile(form: FormData): Promise<IngestResult> {
  try {
    const file = form.get("file");
    if (!(file instanceof File)) return { ok: false, error: "failed", message: "no file received" };
    if (file.size > MAX_FILE_BYTES) return { ok: false, error: "too_big" };
    if (!db) return { ok: false, error: "no_session" };

    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };

    const type = file.type || "";
    const isAudio = type.startsWith("audio/") || type.startsWith("video/");
    const isText =
      type.startsWith("text/") ||
      type === "application/json" ||
      /\.(txt|md|markdown|csv)$/i.test(file.name);
    if (!isAudio && !isText) {
      return { ok: false, error: "unsupported", message: type || file.name };
    }

    const estimate = isAudio ? estimateTranscribe() : estimateIngest();
    if ((await forOrg(db, ctx.orgId).balance()) < estimate) {
      return { ok: false, error: "insufficient_credits" };
    }

    let text: string;
    if (isAudio) {
      if (!hasTranscribeKey()) return { ok: false, error: "no_transcribe_key" };
      text = await transcribeAudio(file, file.name);
    } else {
      text = (await file.text()).trim();
    }
    if (text.length < 20) return { ok: false, error: "empty" };
    return await storeText(ctx.orgId, ctx.brandId, text, {
      kind: isAudio ? "audio" : "text",
      title: file.name,
      cost: estimate,
      reason: isAudio ? "ingest_audio" : "ingest_file",
    });
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}
