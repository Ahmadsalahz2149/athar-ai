"use server";

import { embed, hasEmbeddingKey } from "@/lib/ai/embed";
import { transcribeAudio, hasTranscribeKey } from "@/lib/ai/transcribe";
import { chunkArabic } from "@/lib/ai/chunk";
import { extractPdfText } from "@/lib/ingest/extractPdf";
import { fetchUrlText } from "@/lib/ingest/fetchUrl";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { estimateIngest, estimateTranscribe } from "@/lib/credits/costs";

/** Options captured on the Upload screen (design parity, really stored/applied). */
export type IngestOptions = {
  language?: string;
  category?: string;
  /** analyze_only | ideas | posts | dna | campaign — drives post-ingest steps. */
  actions?: string[];
};

export type IngestResult =
  | { ok: true; chunks: number; totalChunks: number; cost: number; sourceId: string }
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
  meta: { kind: string; title: string | null; cost: number; reason: string; opts?: IngestOptions },
): Promise<IngestResult> {
  if (!hasEmbeddingKey()) return { ok: false, error: "no_embed_key" };
  const t = forOrg(db!, orgId);
  const chunks = chunkArabic(text);
  if (!chunks.length) return { ok: false, error: "empty" };
  const vectors = await embed(chunks.map((c) => c.content), "document");
  const sourceId = await t.saveSource(brandId, {
    kind: meta.kind,
    title: meta.title,
    language: meta.opts?.language ?? null,
    category: meta.opts?.category ?? null,
  });
  await t.saveChunks(
    brandId,
    sourceId,
    chunks.map((c, i) => ({ idx: c.idx, content: c.content, embedding: vectors[i] })),
  );
  await t.debit(meta.cost, meta.reason, "source", sourceId);
  const totalChunks = await t.countChunks(brandId);
  return { ok: true, chunks: chunks.length, totalChunks, cost: meta.cost, sourceId };
}

/** Ingest pasted text: chunk (Arabic-aware) → embed (Voyage) → store as a source
 * with per-chunk vectors, scoped to the signed-in user's brand. */
export async function ingestText(input: { title?: string; text: string; opts?: IngestOptions }): Promise<IngestResult> {
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
      opts: input.opts,
    });
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Ingest an uploaded file: audio/video → ElevenLabs transcription; text files →
 * read directly. Then the shared chunk→embed→store tail. */
export async function ingestFile(form: FormData): Promise<IngestResult> {
  try {
    const opts: IngestOptions = {
      language: (form.get("language") as string) || undefined,
      category: (form.get("category") as string) || undefined,
    };
    const file = form.get("file");
    if (!(file instanceof File)) return { ok: false, error: "failed", message: "no file received" };
    if (file.size > MAX_FILE_BYTES) return { ok: false, error: "too_big" };
    if (!db) return { ok: false, error: "no_session" };

    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };

    const type = file.type || "";
    const isAudio = type.startsWith("audio/") || type.startsWith("video/");
    const isPdf = type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isText =
      type.startsWith("text/") ||
      type === "application/json" ||
      /\.(txt|md|markdown|csv)$/i.test(file.name);
    if (!isAudio && !isPdf && !isText) {
      return { ok: false, error: "unsupported", message: type || file.name };
    }

    const estimate = isAudio ? estimateTranscribe() : estimateIngest();
    if ((await forOrg(db, ctx.orgId).balance()) < estimate) {
      return { ok: false, error: "insufficient_credits" };
    }

    let text: string;
    let kind: string;
    if (isAudio) {
      if (!hasTranscribeKey()) return { ok: false, error: "no_transcribe_key" };
      text = await transcribeAudio(file, file.name);
      kind = "audio";
    } else if (isPdf) {
      text = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
      kind = "pdf";
    } else {
      text = (await file.text()).trim();
      kind = "text";
    }
    if (text.length < 20) return { ok: false, error: "empty" };
    return await storeText(ctx.orgId, ctx.brandId, text, {
      kind,
      title: file.name,
      cost: estimate,
      reason: isAudio ? "ingest_audio" : isPdf ? "ingest_pdf" : "ingest_file",
      opts,
    });
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Ingest a public URL: SSRF-safe fetch → HTML/PDF/text extraction → store. */
export async function ingestUrl(input: { url: string; opts?: IngestOptions }): Promise<IngestResult> {
  try {
    const url = (input.url ?? "").trim();
    if (!url) return { ok: false, error: "too_few" };
    if (!db) return { ok: false, error: "no_session" };

    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };

    const estimate = estimateIngest();
    if ((await forOrg(db, ctx.orgId).balance()) < estimate) {
      return { ok: false, error: "insufficient_credits" };
    }

    const { text, title } = await fetchUrlText(url);
    if (text.length < 20) return { ok: false, error: "empty" };
    return await storeText(ctx.orgId, ctx.brandId, text, {
      kind: "url",
      title,
      cost: estimate,
      reason: "ingest_url",
      opts: input.opts,
    });
  } catch (e) {
    return { ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}
