import { forOrg } from "@/lib/db/forOrg";
import { embed } from "@/lib/ai/embed";
import { transcribeAudio } from "@/lib/ai/transcribe";
import { chunkArabic } from "@/lib/ai/chunk";
import { extractPdfText } from "@/lib/ingest/extractPdf";
import { downloadBytes, removeObject } from "@/lib/storage/uploads";
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
  const org = forOrg(db, job.orgId);
  const brandId = job.brandId;

  try {
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
    await org.debit(p.cost, p.reason, "source", p.sourceId); // last: retries never double-charge

    if (p.mode === "file") {
      try { await removeObject(p.storagePath); } catch { /* best-effort cleanup */ }
    }
    // Chain analysis when the user asked for ideas/DNA on upload.
    if (p.analyzeAfter) {
      await org.enqueueJob(brandId, "analyze_source", { sourceId: p.sourceId });
    }
    await progress(100, "done");
    return { sourceId: p.sourceId, chunks: chunks.length };
  } catch (e) {
    await org.setSourceStatus(brandId, p.sourceId, "failed").catch(() => {});
    throw e;
  }
};
