import { forOrg } from "@/lib/db/forOrg";
import { toPlatformId } from "@/lib/social/registry";
import { fetchPostMetrics, isEmpty, MetricsError } from "@/lib/social/metrics";
import { needsRefresh, refreshToken, supportsRefresh } from "@/lib/social/tokens";
import { log } from "@/lib/log";
import type { JobHandler } from "../runner";

export type CollectMetricsPayload = { draftId: string };

/** Today in UTC as YYYY-MM-DD — the snapshot's dedupe key. UTC, not local,
 * so a worker restart in a different timezone cannot split one day in two. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Read one published post's current numbers back from its platform (Phase 8).
 *
 * This is the job that turns "we posted it" into "here is what happened",
 * which is the whole basis of the analytics and of the DNA learning from real
 * performance rather than from our own guess.
 *
 * It is deliberately quiet about failure. Metrics are a nice-to-have on top of
 * a post that already went out successfully: a platform that refuses to share
 * them must not turn into an error the customer sees, or a job that retries
 * forever. Only a genuinely transient fault throws.
 */
export const collectMetricsHandler: JobHandler = async ({ db, job, progress }) => {
  const { draftId } = job.payload as unknown as CollectMetricsPayload;
  if (!draftId) throw new Error("collect_metrics payload is missing draftId");

  const org = forOrg(db, job.orgId);
  const draft = await org.draftForPublish(job.brandId, draftId);
  if (!draft) return { collected: false, reason: "draft_missing" };
  if (draft.status !== "published") return { collected: false, reason: `not_published:${draft.status}` };
  if (!draft.externalPostId) return { collected: false, reason: "no_external_id" };

  const platform = toPlatformId(draft.platform);
  if (!platform) return { collected: false, reason: `unsupported_platform:${draft.platform}` };

  const conn = await org.getConnection(job.brandId, platform);
  // The account was disconnected after the post went out. The post is still
  // live on the platform; we simply can no longer read it.
  if (!conn || conn.status !== "connected") return { collected: false, reason: `not_connected:${platform}` };

  await progress(30, "token");
  let accessToken = conn.accessToken;
  if (needsRefresh(conn) && conn.refreshToken && supportsRefresh(platform)) {
    try {
      const fresh = await refreshToken(platform, conn.refreshToken);
      await org.updateConnectionTokens(job.brandId, platform, fresh);
      accessToken = fresh.accessToken;
    } catch {
      await org.markConnectionExpired(job.brandId, platform);
      return { collected: false, reason: `token_expired:${platform}` };
    }
  }

  await progress(60, "fetch");
  try {
    const metrics = await fetchPostMetrics(platform, { accessToken, externalAccountId: conn.externalAccountId }, draft.externalPostId);

    // Nothing usable came back. Writing a row of all-nulls would claim we
    // measured this post and found nothing, which is not what happened.
    if (isEmpty(metrics)) return { collected: false, reason: "no_metrics_available" };

    await org.recordPostMetrics(job.brandId, draftId, {
      platform,
      externalPostId: draft.externalPostId,
      ...metrics,
      capturedOn: todayUtc(),
    });
    log.info("metrics.collected", { draftId, platform, ...metrics });
    return { collected: true, platform, ...metrics };
  } catch (e) {
    const err = e instanceof MetricsError ? e : new MetricsError(e instanceof Error ? e.message : String(e), { retryable: false });
    if (err.authInvalid) await org.markConnectionExpired(job.brandId, platform);

    // A missing scope is a platform approval to obtain, not a fault to retry —
    // backing off for days would not make the permission appear.
    if (err.permission) {
      log.info("metrics.not_permitted", { draftId, platform, error: err.message });
      return { collected: false, reason: `not_permitted:${platform}` };
    }
    if (!err.retryable) {
      log.info("metrics.unavailable", { draftId, platform, error: err.message });
      return { collected: false, reason: "unavailable" };
    }
    throw err;
  }
};
