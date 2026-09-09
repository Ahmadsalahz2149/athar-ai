import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db/forOrg";
import { type JobRow } from "./types";

/**
 * System-level job queue operations (INFRA phase 1). These run in a trusted
 * worker context and operate ACROSS orgs, so unlike tenant tables they use the
 * raw db — `jobs` is deliberately not in the ADR-005 protected set. User-facing
 * enqueue/status stay org-scoped in forOrg (enqueueJob / getJob / sourceJob).
 *
 * Lease discipline: a claim stamps `locked_by` + `locked_at`. Every later write
 * for that run is *fenced* on `locked_by`, so a worker whose lease was reaped
 * (it stalled past the reaper window) can no longer write over the run that now
 * owns the job. `setProgress` doubles as the heartbeat that renews the lease.
 */

const cols = sql`id, org_id AS "orgId", brand_id AS "brandId", type, status, payload, progress, phase, attempts, max_attempts AS "maxAttempts", last_error AS "lastError", result, locked_at AS "lockedAt", locked_by AS "lockedBy", run_after AS "runAfter", created_at AS "createdAt", updated_at AS "updatedAt"`;

/** Backoff in SQL, mirroring backoffSeconds() in types.ts: 30s · 2m · 8m …, capped at 1h. */
const backoffSql = sql`(LEAST(30 * power(4, GREATEST(attempts - 1, 0)), 3600) * interval '1 second')`;

/** Atomically claim the next runnable job. Uses FOR UPDATE SKIP LOCKED so any
 * number of concurrent workers never grab the same row. Returns null if idle.
 * `orgId` restricts the claim to one tenant — the client-side pump uses it so a
 * signed-in user can only drive their own queue, never another org's jobs. */
export async function claimNext(db: Db, workerId: string, orgId?: string): Promise<JobRow | null> {
  const only = orgId ?? null;
  const rows = await db.execute(sql`
    UPDATE jobs SET
      status = 'running',
      locked_at = now(),
      locked_by = ${workerId},
      attempts = attempts + 1,
      updated_at = now()
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'queued' AND run_after <= now() AND attempts < max_attempts
        AND (${only}::uuid IS NULL OR org_id = ${only}::uuid)
      ORDER BY run_after ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING ${cols}
  `);
  const list = rows as unknown as JobRow[];
  return list[0] ?? null;
}

/** Report progress and renew the lease. The heartbeat is what keeps a healthy
 * long job (audio transcription + embedding can outrun the reaper window) from
 * being reclaimed and executed a second time at full provider cost. */
export async function setProgress(db: Db, jobId: string, progress: number, phase?: string, workerId?: string): Promise<void> {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const owner = workerId ?? null;
  await db.execute(sql`
    UPDATE jobs SET progress = ${pct}, phase = ${phase ?? null},
      locked_at = now(), updated_at = now()
    WHERE id = ${jobId} AND (${owner}::text IS NULL OR locked_by = ${owner})
  `);
}

/** Mark a job done. Returns false when the lease was lost (another worker owns
 * the job now), so the caller can log it instead of silently overwriting. */
export async function complete(db: Db, jobId: string, result?: Record<string, unknown>, workerId?: string): Promise<boolean> {
  const owner = workerId ?? null;
  const rows = await db.execute(sql`
    UPDATE jobs SET
      status = 'done', progress = 100, result = ${JSON.stringify(result ?? {})}::jsonb,
      locked_at = null, locked_by = null, last_error = null, updated_at = now()
    WHERE id = ${jobId} AND (${owner}::text IS NULL OR locked_by = ${owner})
    RETURNING id
  `);
  return (rows as unknown as unknown[]).length > 0;
}

/** Mark a job failed. Retries with exponential backoff until max_attempts is
 * exhausted, then parks it as 'dead' (dead-letter). `attempts` was already
 * incremented at claim time. Fenced on the lease like complete(). */
export async function fail(db: Db, job: JobRow, error: string, workerId?: string): Promise<boolean> {
  const dead = job.attempts >= job.maxAttempts;
  const owner = workerId ?? null;
  const rows = dead
    ? await db.execute(sql`
        UPDATE jobs SET status = 'dead', last_error = ${error.slice(0, 2000)},
          locked_at = null, locked_by = null, updated_at = now()
        WHERE id = ${job.id} AND (${owner}::text IS NULL OR locked_by = ${owner})
        RETURNING id
      `)
    : await db.execute(sql`
        UPDATE jobs SET status = 'queued', last_error = ${error.slice(0, 2000)},
          run_after = now() + ${backoffSql},
          locked_at = null, locked_by = null, updated_at = now()
        WHERE id = ${job.id} AND (${owner}::text IS NULL OR locked_by = ${owner})
        RETURNING id
      `);
  return (rows as unknown as unknown[]).length > 0;
}

/** Counts by status for health/metrics (INFRA phase 6). Cross-org, system view. */
export async function queueDepth(db: Db): Promise<Record<string, number>> {
  const rows = await db.execute(sql`SELECT status, count(*)::int AS n FROM jobs GROUP BY status`);
  const out: Record<string, number> = { queued: 0, running: 0, done: 0, failed: 0, dead: 0 };
  for (const r of rows as unknown as { status: string; n: number }[]) out[r.status] = r.n;
  return out;
}

/** Reclaim jobs stuck in 'running' past a timeout (a worker crashed mid-run, or
 * stopped heartbeating). A reclaimed job respects the retry cap: one that has
 * already burned its attempts is parked as 'dead' rather than re-queued
 * forever, and a retry gets the same backoff a normal failure would. */
export async function reapStale(db: Db, staleSeconds = 1800, orgId?: string): Promise<number> {
  const only = orgId ?? null;
  const rows = await db.execute(sql`
    UPDATE jobs SET
      status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END,
      run_after = CASE WHEN attempts >= max_attempts THEN run_after ELSE now() + ${backoffSql} END,
      last_error = 'worker lease expired (no heartbeat); job reclaimed',
      locked_at = null, locked_by = null, updated_at = now()
    WHERE status = 'running' AND locked_at < now() - (${staleSeconds} * interval '1 second')
      AND (${only}::uuid IS NULL OR org_id = ${only}::uuid)
    RETURNING id
  `);
  return (rows as unknown as unknown[]).length;
}
