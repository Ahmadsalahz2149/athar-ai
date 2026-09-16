import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db/forOrg";
import { log } from "@/lib/log";
import { asSystem, rlsEnabled, setSystemScope } from "@/lib/db/rls";

/**
 * Scheduled-post dispatcher (Phase 7.4). Cross-org by design, like the job
 * queue it feeds: it runs in the trusted worker context and has no user behind
 * it, so it uses raw `db.execute` rather than the tenancy façade — every row it
 * touches carries its own org_id, which is copied straight onto the job.
 *
 * The claim and the enqueue happen in ONE transaction. If the insert fails, the
 * claim rolls back with it and the draft stays 'scheduled' — the alternative
 * (claim, then enqueue) loses a post permanently on any error in between.
 *
 * `FOR UPDATE SKIP LOCKED` makes concurrent workers safe: two cron invocations
 * that overlap cannot claim the same draft, so nothing is posted twice.
 */

export const PUBLISH_JOB = "publish_draft";
/** Publishing is a paid, user-visible side effect; two retries past the first
 * attempt is enough to ride out a rate limit without spamming a flaky API. */
export const PUBLISH_MAX_ATTEMPTS = 3;

type Claimed = { id: string; orgId: string; brandId: string; platform: string };

/** Claim every scheduled draft whose time has come and enqueue a publish job
 * for each. Returns how many were dispatched. */
export async function dispatchDuePublishes(db: Db, limit = 20): Promise<number> {
  const claimed = await db.transaction(async (tx) => {
    // Cross-org by design: this claims due posts for every tenant at once.
    if (rlsEnabled()) await setSystemScope(tx);
    const rows = await tx.execute(sql`
      UPDATE drafts SET status = 'publishing'
      WHERE id IN (
        SELECT id FROM drafts
        WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now()
          AND deleted_at IS NULL
        ORDER BY scheduled_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, org_id AS "orgId", brand_id AS "brandId", platform
    `);
    const list = rows as unknown as Claimed[];
    for (const d of list) {
      await tx.execute(sql`
        INSERT INTO jobs (org_id, brand_id, type, payload, max_attempts)
        VALUES (${d.orgId}::uuid, ${d.brandId}::uuid, ${PUBLISH_JOB},
                ${JSON.stringify({ draftId: d.id })}::jsonb, ${PUBLISH_MAX_ATTEMPTS})
      `);
    }
    return list;
  });

  if (claimed.length) log.info("publish.dispatched", { n: claimed.length });
  return claimed.length;
}

/**
 * Recover drafts stranded in 'publishing'. This happens when a worker's lease
 * expired without the handler ever running (the process died between claim and
 * execution), so nothing will ever move the draft again.
 *
 * Two conditions together make this safe against double-posting: there is no
 * live job for the draft, and the claim is older than the queue's own 30-minute
 * reaper window — well past the 30-second cap on any single platform call, so a
 * request that could still land cannot be in flight.
 */
export async function requeueAbandonedPublishes(db: Db, olderThanMinutes = 60): Promise<number> {
  const rows = await asSystem(db, (tx) => tx.execute(sql`
    UPDATE drafts SET status = 'scheduled'
    WHERE status = 'publishing'
      AND scheduled_at < now() - (${olderThanMinutes} * interval '1 minute')
      AND NOT EXISTS (
        SELECT 1 FROM jobs
        WHERE jobs.type = ${PUBLISH_JOB}
          AND jobs.status IN ('queued', 'running')
          AND jobs.payload->>'draftId' = drafts.id::text
      )
    RETURNING id
  `));
  const n = (rows as unknown as unknown[]).length;
  if (n) log.warn("publish.requeued_abandoned", { n });
  return n;
}

export const METRICS_JOB = "collect_metrics";
/** Collection is idempotent, so a transient failure is cheap to retry. */
export const METRICS_MAX_ATTEMPTS = 3;
/** How long a post stays worth re-reading. Engagement is effectively settled
 * well before this; past it we would be spending API calls on a flat line. */
export const METRICS_WINDOW_DAYS = 30;

/**
 * Enqueue a metrics collection for every published post that has no snapshot
 * today (Phase 8).
 *
 * Unlike the publish dispatcher this needs no claim transaction, and that is a
 * property of the work rather than an oversight: collecting twice writes the
 * same row twice, which the daily unique index turns into a refresh. The only
 * thing worth avoiding is piling up duplicate JOBS, which the NOT EXISTS below
 * does — so the whole thing is one statement instead of a claim-and-enqueue
 * dance.
 */
export async function dispatchDueMetrics(db: Db, limit = 25): Promise<number> {
  const rows = await asSystem(db, (tx) => tx.execute(sql`
    INSERT INTO jobs (org_id, brand_id, type, payload, max_attempts)
    SELECT d.org_id, d.brand_id, ${METRICS_JOB},
           jsonb_build_object('draftId', d.id::text), ${METRICS_MAX_ATTEMPTS}
    FROM drafts d
    WHERE d.status = 'published'
      AND d.external_post_id IS NOT NULL
      AND d.deleted_at IS NULL
      AND d.published_at > now() - (${METRICS_WINDOW_DAYS} * interval '1 day')
      AND NOT EXISTS (
        SELECT 1 FROM post_metrics m
        WHERE m.draft_id = d.id AND m.captured_on = current_date
      )
      AND NOT EXISTS (
        SELECT 1 FROM jobs j
        WHERE j.type = ${METRICS_JOB}
          AND j.status IN ('queued', 'running')
          AND j.payload->>'draftId' = d.id::text
      )
    ORDER BY d.published_at DESC
    LIMIT ${limit}
    RETURNING id
  `));
  const n = (rows as unknown as unknown[]).length;
  if (n) log.info("metrics.dispatched", { n });
  return n;
}
