import type { Db } from "@/lib/db/forOrg";
import type { JobRow } from "./types";
import { claimNext, complete, fail, setProgress } from "./queue";

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

/** Claim and run a single job. Safe to call concurrently (claim is atomic). */
export async function runOne(db: Db, workerId: string): Promise<RunOutcome> {
  const job = await claimNext(db, workerId);
  if (!job) return "idle";
  const handler = registry.get(job.type);
  if (!handler) {
    await fail(db, job, `No handler registered for job type "${job.type}"`);
    return "no_handler";
  }
  try {
    const result = await handler({
      db,
      job,
      progress: (pct, phase) => setProgress(db, job.id, pct, phase),
    });
    await complete(db, job.id, result ?? {});
    return "ok";
  } catch (e) {
    await fail(db, job, e instanceof Error ? e.message : String(e));
    return "failed";
  }
}

/** Drain up to `max` jobs, stopping as soon as the queue is idle. Returns the
 * number of jobs processed (ok + failed + no_handler). */
export async function runBatch(db: Db, workerId: string, max = 5): Promise<number> {
  let n = 0;
  for (; n < max; n++) {
    const outcome = await runOne(db, workerId);
    if (outcome === "idle") break;
  }
  return n;
}
