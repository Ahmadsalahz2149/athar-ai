/** Background job contracts (INFRA phase 1). */

export type JobType = "ingest_source" | "analyze_source" | "synthesize_dna";
export type JobStatus = "queued" | "running" | "done" | "failed" | "dead";

export type JobRow = {
  id: string;
  orgId: string;
  brandId: string;
  type: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  progress: number;
  phase: string | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  result: Record<string, unknown> | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  runAfter: Date;
  createdAt: Date;
  updatedAt: Date;
};

/** Retry backoff: 30s · 2m · 8m … (exponential, capped). Deterministic — no jitter
 * needed for this volume, and it keeps tests reproducible. */
export function backoffSeconds(attempt: number): number {
  return Math.min(30 * 4 ** Math.max(0, attempt - 1), 3600);
}
