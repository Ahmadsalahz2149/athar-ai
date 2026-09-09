import type { Db } from "@/lib/db/forOrg";
import type { JobRow } from "./types";
import { claimNext, complete, fail, setProgress } from "./queue";
import { log } from "@/lib/log";

/** A job handler runs the work and may report progress. Returning a value stores
 * it as the job result. Throwing triggers retry/backoff via fail(). */
export type JobHandler = (ctx: {
  db: Db;
  job: JobRow;
  progress: (pct: number, phase?: string) => Promise<void>;
}) => Promise<Record<string, unknown> | void>;

const registry = new Map<string, JobHandler>();

export function registerHandler(type: string, handler: JobHandler): void {
  registry.set(type, handler);
}
export function hasHandler(type: string): boolean {
  return registry.has(type);
}

export type RunOutcome = "idle" | "ok" | "failed" | "no_handler";

/** Claim and run a single job. Safe to call concurrently (claim is atomic).
 * Every write back to the job is fenced on this worker's lease, so if the run
 * stalled long enough to be reaped its result is discarded instead of stomping
 * the worker that now owns the job. */
export async function runOne(db: Db, workerId: string, orgId?: string): Promise<RunOutcome> {
  const job = await claimNext(db, workerId, orgId);
  if (!job) return "idle";
  const handler = registry.get(job.type);
  if (!handler) {
    log.error("job.no_handler", { jobId: job.id, type: job.type });
    await fail(db, job, `No handler registered for job type "${job.type}"`, workerId);
    return "no_handler";
  }
  const started = Date.now();
  try {
    const result = await handler({
      db,
      job,
      // Doubles as the lease heartbeat — handlers that report progress keep the
      // reaper from reclaiming them mid-run.
      progress: (pct, phase) => setProgress(db, job.id, pct, phase, workerId),
    });
    const kept = await complete(db, job.id, result ?? {}, workerId);
    if (!kept) {
      log.warn("job.lease_lost", { jobId: job.id, type: job.type, ms: Date.now() - started });
      return "failed";
    }
    log.info("job.done", { jobId: job.id, type: job.type, attempt: job.attempts, ms: Date.now() - started });
    return "ok";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const kept = await fail(db, job, msg, workerId);
    if (!kept) log.warn("job.lease_lost_on_fail", { jobId: job.id, type: job.type });
    log.warn("job.failed", { jobId: job.id, type: job.type, attempt: job.attempts, maxAttempts: job.maxAttempts, ms: Date.now() - started, error: msg });
    return "failed";
  }
}

/** Drain up to `max` jobs, stopping as soon as the queue is idle. Returns the
 * number of jobs processed (ok + failed + no_handler).
 *
 * `budgetMs` bounds the drain so the invocation finishes before the platform
 * kills it: a job started near the deadline would be terminated mid-run and sit
 * 'running' until the reaper window elapsed. We only *start* a job when the
 * budget still has room. */
export async function runBatch(db: Db, workerId: string, max = 5, budgetMs = 240_000, orgId?: string): Promise<number> {
  const deadline = Date.now() + budgetMs;
  let n = 0;
  for (; n < max; n++) {
    if (Date.now() >= deadline) {
      log.info("job.batch_budget_reached", { workerId, processed: n });
      break;
    }
    const outcome = await runOne(db, workerId, orgId);
    if (outcome === "idle") break;
    // A failed job has already been re-queued with backoff. End this drain so
    // another queued job cannot consume the same constrained provider quota
    // and so retries happen in a fresh worker invocation.
    if (outcome === "failed" || outcome === "no_handler") {
      n++;
      break;
    }
  }
  return n;
}
