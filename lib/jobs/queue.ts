import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db/forOrg";
import { backoffSeconds, type JobRow } from "./types";

/**
 * System-level job queue operations (INFRA phase 1). These run in a trusted
 * worker context and operate ACROSS orgs, so unlike tenant tables they use the
 * raw db — `jobs` is deliberately not in the ADR-005 protected set. User-facing
 * enqueue/status stay org-scoped in forOrg (enqueueJob / getJob / sourceJob).
 */

const cols = sql`id, org_id AS "orgId", brand_id AS "brandId", type, status, payload, progress, phase, attempts, max_attempts AS "maxAttempts", last_error AS "lastError", result, locked_at AS "lockedAt", locked_by AS "lockedBy", run_after AS "runAfter", created_at AS "createdAt", updated_at AS "updatedAt"`;

/** Atomically claim the next runnable job. Uses FOR UPDATE SKIP LOCKED so any
 * number of concurrent workers never grab the same row. Returns null if idle. */
export async function claimNext(db: Db, workerId: string): Promise<JobRow | null> {
  const rows = await db.execute(sql`
    UPDATE jobs SET
      status = 'running',
      locked_at = now(),
      locked_by = ${workerId},
      attempts = attempts + 1,
      updated_at = now()
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'queued' AND run_after <= now()
      ORDER BY run_after ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING ${cols}
  `);
  const list = rows as unknown as JobRow[];
  return list[0] ?? null;
}

export async function setProgress(db: Db, jobId: string, progress: number, phase?: string): Promise<void> {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  await db.execute(sql`
    UPDATE jobs SET progress = ${pct}, phase = ${phase ?? null}, updated_at = now()
    WHERE id = ${jobId}
  `);
}

export async function complete(db: Db, jobId: string, result?: Record<string, unknown>): Promise<void> {
  await db.execute(sql`
    UPDATE jobs SET
      status = 'done', progress = 100, result = ${JSON.stringify(result ?? {})}::jsonb,
      locked_at = null, locked_by = null, last_error = null, updated_at = now()
    WHERE id = ${jobId}
  `);
}

/** Mark a job failed. Retries with exponential backoff until max_attempts is
 * exhausted, then parks it as 'dead' (dead-letter). `attempts` was already
 * incremented at claim time. */
export async function fail(db: Db, job: JobRow, error: string): Promise<void> {
  const dead = job.attempts >= job.maxAttempts;
  if (dead) {
    await db.execute(sql`
      UPDATE jobs SET status = 'dead', last_error = ${error.slice(0, 2000)},
        locked_at = null, locked_by = null, updated_at = now()
      WHERE id = ${job.id}
    `);
    return;
  }
  const delay = backoffSeconds(job.attempts);
  await db.execute(sql`
    UPDATE jobs SET status = 'queued', last_error = ${error.slice(0, 2000)},
      run_after = now() + (${delay} * interval '1 second'),
      locked_at = null, locked_by = null, updated_at = now()
    WHERE id = ${job.id}
  `);
}

/** Counts by status for health/metrics (INFRA phase 6). Cross-org, system view. */
export async function queueDepth(db: Db): Promise<Record<string, number>> {
  const rows = await db.execute(sql`SELECT status, count(*)::int AS n FROM jobs GROUP BY status`);
  const out: Record<string, number> = { queued: 0, running: 0, done: 0, failed: 0, dead: 0 };
  for (const r of rows as unknown as { status: string; n: number }[]) out[r.status] = r.n;
  return out;
}

/** Reclaim jobs stuck in 'running' past a timeout (a worker crashed mid-run).
 * Re-queues them for another attempt. Returns how many were reaped. */
export async function reapStale(db: Db, staleSeconds = 1800): Promise<number> {
  const rows = await db.execute(sql`
    UPDATE jobs SET status = 'queued', locked_at = null, locked_by = null, updated_at = now()
    WHERE status = 'running' AND locked_at < now() - (${staleSeconds} * interval '1 second')
    RETURNING id
  `);
  return (rows as unknown as unknown[]).length;
}
