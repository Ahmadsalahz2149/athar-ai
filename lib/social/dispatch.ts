import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db/forOrg";
import { log } from "@/lib/log";

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
  const rows = await db.execute(sql`
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
  `);
  const n = (rows as unknown as unknown[]).length;
  if (n) log.warn("publish.requeued_abandoned", { n });
  return n;
}
