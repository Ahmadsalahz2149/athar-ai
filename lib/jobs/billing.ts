import { forOrg, InsufficientCreditsError, type Db } from "@/lib/db/forOrg";
import { log } from "@/lib/log";

/**
 * Credit handling for background jobs.
 *
 * Jobs charge *after* the work succeeds, so a failed generation is never billed.
 * The gap that left: an org that cannot pay still ran the full (expensive)
 * provider call, and the debit then threw `InsufficientCreditsError` *after* the
 * result had been saved — so the job retried the same paid call until it died,
 * having already delivered the output. These two helpers close both ends.
 */

/** Cheap pre-flight before the paid call: skip the work entirely when the org
 * cannot cover it, instead of generating first and failing at the till. */
export async function canAfford(db: Db, orgId: string, cost: number): Promise<boolean> {
  if (!Number.isFinite(cost) || cost <= 0) return true;
  return (await forOrg(db, orgId).balance()) >= cost;
}

/** Charge for work that is already persisted. `debitOnce` keeps retries safe. A
 * shortfall at this point is a race (the balance drained between the pre-flight
 * and now); the output is already saved, so record it and let the job finish
 * rather than discarding delivered work and re-running the paid call. */
export async function chargeForDeliveredWork(
  db: Db,
  orgId: string,
  cost: number,
  reason: string,
  key: string,
  refType?: string,
  refId?: string,
): Promise<void> {
  try {
    await forOrg(db, orgId).debitOnce(cost, reason, key, refType, refId);
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      log.warn("job.delivered_unbilled", { orgId, reason, key, cost });
      return;
    }
    throw e;
  }
}
