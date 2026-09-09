import { forOrg } from "@/lib/db/forOrg";
import { embed } from "@/lib/ai/embed";
import { transcribeAudio } from "@/lib/ai/transcribe";
import { chunkArabic } from "@/lib/ai/chunk";
import { extractPdfText } from "@/lib/ingest/extractPdf";
import { downloadBytes, removeObject } from "@/lib/storage/uploads";
import { canAfford, chargeForDeliveredWork } from "../billing";
import type { JobHandler } from "../runner";

/** Discriminated payload for an `ingest_source` job. Text-derived inputs (paste,
 * URL) carry the already-extracted text; files carry a storage path the job
 * downloads and extracts, so long transcriptions run outside the request. */
type Common = { sourceId: string; cost: number; reason: string; analyzeAfter?: boolean };
export type IngestJobPayload =
  | ({ mode: "text"; text: string } & Common)
  | ({ mode: "file"; storagePath: string; fileName: string; fileKind: "audio" | "pdf" | "text" } & Common);

/**
 * The heavy ingest pipeline, run as a background job: extract → chunk → embed →
 * store chunks → mark source ready → debit. Idempotent: clears any chunks from a
 * prior failed attempt before writing, and debits last so a retry never
 * double-charges. On failure it marks the source `failed` and rethrows so the
 * queue retries with backoff.
 */
export const ingestSourceHandler: JobHandler = async ({ db, job, progress }) => {
  const p = job.payload as unknown as IngestJobPayload;
  // Validate the payload before charging anything: `cost` was trusted verbatim,
  // so a missing value reached the ledger as NaN after all the work was done.
  if (!p?.sourceId) throw new Error("ingest_source payload is missing sourceId");
  if (!Number.isFinite(p.cost)) throw new Error("ingest_source payload has an invalid cost");
  const org = forOrg(db, job.orgId);
  const brandId = job.brandId;

  try {
    await org.setSourceStatus(brandId, p.sourceId, "processing");
    // Pay-gate before the paid work (transcription + embeddings), not after.
    if (!(await canAfford(db, job.orgId, p.cost))) {
      await org.setSourceStatus(brandId, p.sourceId, "failed").catch(() => {});
      return { sourceId: p.sourceId, skipped: "insufficient_credits" };
    }
    await progress(10, "extract");
    let text: string;
    if (p.mode === "file") {
      const bytes = await downloadBytes(p.storagePath);
      if (p.fileKind === "audio") {
        const file = new File([bytes as BlobPart], p.fileName, { type: "application/octet-stream" });
        text = await transcribeAudio(file, p.fileName);
      } else if (p.fileKind === "pdf") {
        text = await extractPdfText(bytes);
      } else {
        text = new TextDecoder().decode(bytes).trim();
      }
    } else {
      text = p.text;
    }
    if (!text || text.trim().length < 20) throw new Error("empty extraction");

    await progress(45, "embed");
    const chunks = chunkArabic(text);
    if (!chunks.length) throw new Error("no chunks produced");
    const vectors = await embed(chunks.map((c) => c.content), "document");

    await progress(80, "store");
    await org.clearChunks(brandId, p.sourceId); // idempotent re-run
    await org.saveChunks(brandId, p.sourceId, chunks.map((c, i) => ({ idx: c.idx, content: c.content, embedding: vectors[i] })));
    await org.setSourceStatus(brandId, p.sourceId, "ready");
    await chargeForDeliveredWork(db, job.orgId, p.cost, p.reason, `ingest:${p.sourceId}`, "source", p.sourceId);

    // Chain analysis + DNA synthesis when the user asked for ideas/DNA on upload.
    // Synthesis reads ALL the brand's chunks (including these), so uploading
    // posts actually builds the Content DNA — the core "learn my voice" step.
    if (p.analyzeAfter) {
      await org.enqueueJob(brandId, "analyze_source", { sourceId: p.sourceId });
      await org.enqueueJob(brandId, "synthesize_dna", { trigger: `ingest:${p.sourceId}` });
    }
    // Drop the uploaded file LAST. Deleting it before the steps above meant any
    // throw after the delete left every retry failing at downloadBytes, burning
    // the attempt budget until the job died with the source stuck failed.
    if (p.mode === "file") {
      try { await removeObject(p.storagePath); } catch { /* best-effort cleanup */ }
    }
    await progress(100, "done");
    return { sourceId: p.sourceId, chunks: chunks.length };
  } catch (e) {
    // Only show a terminal 'failed' state once no retry remains — a transient
    // attempt failure leaves the source 'processing' while the queue retries.
    if (job.attempts >= job.maxAttempts) {
      await org.setSourceStatus(brandId, p.sourceId, "failed").catch(() => {});
    }
    throw e;
  }
};
