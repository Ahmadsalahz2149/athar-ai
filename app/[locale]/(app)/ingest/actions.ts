"use server";

import { hasEmbeddingKey } from "@/lib/ai/embed";
import { hasTranscribeKey } from "@/lib/ai/transcribe";
import { fetchUrlText } from "@/lib/ingest/fetchUrl";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { estimateIngest, estimateTranscribe, estimateDna } from "@/lib/credits/costs";
import { uploadBytes, hasStorage } from "@/lib/storage/uploads";
import { kickWorker } from "@/lib/jobs/kick";
import { runBatch } from "@/lib/jobs/runner";
import { reapStale } from "@/lib/jobs/queue";
import "@/lib/jobs/handlers"; // ensure job handlers are registered for the pump

/** Options captured on the Upload screen (design parity, really stored/applied). */
export type IngestOptions = {
  language?: string;
  category?: string;
  /** analyze_only | ideas | posts | dna | campaign — drives post-ingest steps. */
  actions?: string[];
};

/** Ingestion is now asynchronous (INFRA phase 2): the action validates + enqueues
 * and returns a job id; the client polls jobStatus() for progress and the final
 * chunk count. Synchronous errors (keys/credits/unsupported) still return inline. */
export type IngestResult =
  | { ok: true; sourceId: string; jobId: string }
  | {
      ok: false;
      error:
        | "too_few"
        | "no_embed_key"
        | "no_transcribe_key"
        | "no_storage"
        | "no_session"
        | "insufficient_credits"
        | "unsupported"
        | "too_big"
        | "empty"
        | "failed";
      message?: string;
    };

const MAX_FILE_BYTES = 30 * 1024 * 1024; // matches next.config serverActions.bodySizeLimit

/** True when the user's actions imply post-ingest analysis (ideas/DNA). */
function wantsAnalysis(opts?: IngestOptions): boolean {
  const a = opts?.actions ?? [];
  return (a.includes("ideas") || a.includes("dna")) && !a.includes("analyze_only");
}

/** Create the source row (processing) and enqueue a text-mode ingest job. */
async function enqueueText(
  orgId: string,
  brandId: string,
  text: string,
  meta: { kind: string; title: string | null; cost: number; reason: string; opts?: IngestOptions },
): Promise<IngestResult> {
  if (!hasEmbeddingKey()) return { ok: false, error: "no_embed_key" };
  const t = forOrg(db!, orgId);
  const sourceId = await t.saveSource(brandId, {
    kind: meta.kind,
    title: meta.title,
    status: "processing",
    language: meta.opts?.language ?? null,
    category: meta.opts?.category ?? null,
  });
  const jobId = await t.enqueueJob(brandId, "ingest_source", {
    mode: "text",
    sourceId,
    text,
    cost: meta.cost,
    reason: meta.reason,
    analyzeAfter: wantsAnalysis(meta.opts),
  });
  kickWorker();
  return { ok: true, sourceId, jobId };
}

/**
 * Drive the background worker from the client while it polls for a job.
 * Serverless has no always-on worker: the `after()` kick can be cut short by the
 * function duration cap, and on Hobby the durable cron only runs once daily. So
 * the client calls this each poll to actually push its job through the pipeline.
 * Safe to call repeatedly and concurrently — runBatch claims jobs with
 * FOR UPDATE SKIP LOCKED, so overlapping pumps never double-process. */
export async function pumpWorker(): Promise<{ processed: number }> {
  if (!db) return { processed: 0 };
  try {
    await reapStale(db); // recover jobs a prior (killed) invocation left locked
    const processed = await runBatch(db, `pump_${Date.now()}`, 5);
    return { processed };
  } catch {
    return { processed: 0 };
  }
}

/** Build (or rebuild) the brand's Content DNA from its already-uploaded sources.
 * Enqueues a synthesize_dna job and returns its id so the client can poll (and
 * pump) it to completion. Used by the DNA page when sources exist but no DNA has
 * been synthesized yet. */
export async function buildDna(): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  if (!db) return { ok: false, error: "no_session" };
  const ctx = await currentContext();
  if (!ctx) return { ok: false, error: "no_session" };
  const t = forOrg(db, ctx.orgId);
  if ((await t.countChunks(ctx.brandId)) === 0) return { ok: false, error: "no_sources" };
  if ((await t.balance()) < estimateDna()) return { ok: false, error: "insufficient_credits" };
  const jobId = await t.enqueueJob(ctx.brandId, "synthesize_dna", { trigger: `manual:${ctx.brandId}:${Date.now()}` });
  kickWorker();
  return { ok: true, jobId };
}

/** Count of active (queued/running) jobs for the current brand — drives the
 * live "processing" watcher on Vault/Dashboard. */
export async function activeJobsCount(): Promise<number> {
  if (!db) return 0;
  const ctx = await currentContext();
  if (!ctx) return 0;
  const jobs = await forOrg(db, ctx.orgId).activeJobs(ctx.brandId);
  return jobs.length;
}

/** Poll a job's status for the live-progress UI (tenancy-scoped). */
export async function jobStatus(jobId: string): Promise<
  | { ok: true; status: string; progress: number; phase: string | null; chunks?: number; error?: string | null; dnaBuilt?: boolean; dnaSkipped?: string }
  | { ok: false }
> {
  if (!db) return { ok: false };
  const ctx = await currentContext();
  if (!ctx) return { ok: false };
  const job = await forOrg(db, ctx.orgId).getJob(ctx.brandId, jobId);
  if (!job) return { ok: false };
  const result = job.result as { chunks?: number; completion?: number; versionId?: string; skipped?: string } | null;
  // For synthesize_dna jobs: distinguish "done + built" from "done but skipped
  // (not enough content)" so the UI can guide instead of showing a silent 0%.
  const dnaBuilt = typeof result?.completion === "number" || !!result?.versionId;
  return {
    ok: true, status: job.status, progress: job.progress, phase: job.phase,
    chunks: result?.chunks, error: job.lastError,
    dnaBuilt: dnaBuilt || undefined,
    dnaSkipped: result?.skipped,
  };
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
    return await enqueueText(ctx.orgId, ctx.brandId, text, {
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
    const rawActions = form.get("actions");
    const opts: IngestOptions = {
      language: (form.get("language") as string) || undefined,
      category: (form.get("category") as string) || undefined,
      actions: typeof rawActions === "string" && rawActions ? (JSON.parse(rawActions) as string[]) : undefined,
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

    if (isAudio && !hasTranscribeKey()) return { ok: false, error: "no_transcribe_key" };
    if (!hasEmbeddingKey()) return { ok: false, error: "no_embed_key" };
    if (!hasStorage()) return { ok: false, error: "no_storage" };

    const estimate = isAudio ? estimateTranscribe() : estimateIngest();
    if ((await forOrg(db, ctx.orgId).balance()) < estimate) {
      return { ok: false, error: "insufficient_credits" };
    }

    const kind = isAudio ? "audio" : isPdf ? "pdf" : "text";
    const fileKind: "audio" | "pdf" | "text" = isAudio ? "audio" : isPdf ? "pdf" : "text";
    const t = forOrg(db, ctx.orgId);

    // Persist raw bytes to storage, then let the job download + extract + embed
    // so long transcriptions/extractions never run inside this request.
    const sourceId = await t.saveSource(ctx.brandId, {
      kind,
      title: file.name,
      status: "processing",
      language: opts.language ?? null,
      category: opts.category ?? null,
    });
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const storagePath = `${ctx.orgId}/${sourceId}/${safeName}`;
    await uploadBytes(storagePath, await file.arrayBuffer(), file.type || undefined);

    const jobId = await t.enqueueJob(ctx.brandId, "ingest_source", {
      mode: "file",
      sourceId,
      storagePath,
      fileName: file.name,
      fileKind,
      cost: estimate,
      reason: isAudio ? "ingest_audio" : isPdf ? "ingest_pdf" : "ingest_file",
      analyzeAfter: wantsAnalysis(opts),
    });
    kickWorker();
    return { ok: true, sourceId, jobId };
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
    return await enqueueText(ctx.orgId, ctx.brandId, text, {
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
