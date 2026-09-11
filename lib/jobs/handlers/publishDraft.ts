import { forOrg } from "@/lib/db/forOrg";
import { toPlatformId } from "@/lib/social/registry";
import { composePost, publishPost, PublishError } from "@/lib/social/publish";
import { needsRefresh, refreshToken, supportsRefresh } from "@/lib/social/tokens";
import { guardDraft } from "@/lib/ai/guardDraft";
import { log } from "@/lib/log";
import type { JobHandler } from "../runner";

export type PublishJobPayload = { draftId: string };

/** A reason the post can never succeed as-is. Recorded on the draft and shown
 * to the user; the job is completed (not retried) because a retry would fail
 * identically three times and delay the only useful outcome — telling them. */
async function giveUp(
  db: Parameters<JobHandler>[0]["db"],
  orgId: string,
  brandId: string,
  draftId: string,
  reason: string,
): Promise<Record<string, unknown>> {
  await forOrg(db, orgId).markDraftPublishFailed(brandId, draftId, reason);
  log.warn("publish.failed_permanently", { draftId, reason });
  return { published: false, reason };
}

/**
 * Publish one claimed draft to its platform (Phase 7.4).
 *
 * The draft arrives already in 'publishing' — the dispatcher claimed it inside
 * the same transaction that created this job, so this handler is the single
 * owner of that draft and cannot race another worker.
 *
 * Failure handling is deliberately two-sided: a *permanent* rejection (text too
 * long, no image for Instagram, revoked token) ends the job successfully with
 * the reason recorded on the draft, while a *transient* one (429, 5xx, network)
 * throws so the queue retries with backoff. Only on the last attempt does a
 * transient failure also get written to the draft — otherwise a first 500 would
 * show the user a failure that the retry is about to fix.
 */
export const publishDraftHandler: JobHandler = async ({ db, job, progress }) => {
  const { draftId } = job.payload as unknown as PublishJobPayload;
  if (!draftId) throw new Error("publish_draft payload is missing draftId");

  const org = forOrg(db, job.orgId);
  const draft = await org.draftForPublish(job.brandId, draftId);
  // Deleted, or belonging to another tenant: nothing to publish and nothing to
  // record. Not an error — the user simply changed their mind mid-flight.
  if (!draft) return { published: false, reason: "draft_missing" };
  if (draft.status !== "publishing") return { published: false, reason: `not_claimed:${draft.status}` };

  const platform = toPlatformId(draft.platform);
  if (!platform) return giveUp(db, job.orgId, job.brandId, draftId, `unsupported_platform:${draft.platform}`);

  // Same guardrail the approval path enforces, re-run against what is actually
  // stored now: a draft can be edited after approval and before its slot.
  const guard = await guardDraft(db, job.orgId, job.brandId, draftId);
  if (!guard.ok) return giveUp(db, job.orgId, job.brandId, draftId, `unsafe_content:${guard.violations.join(",")}`);

  const conn = await org.getConnection(job.brandId, platform);
  if (!conn || conn.status !== "connected") {
    return giveUp(db, job.orgId, job.brandId, draftId, `not_connected:${platform}`);
  }

  await progress(30, "token");
  let accessToken = conn.accessToken;
  if (needsRefresh(conn) && conn.refreshToken && supportsRefresh(platform)) {
    try {
      const fresh = await refreshToken(platform, conn.refreshToken);
      await org.updateConnectionTokens(job.brandId, platform, fresh);
      accessToken = fresh.accessToken;
    } catch {
      // An expired token that cannot be refreshed needs the user, not a retry.
      await org.markConnectionExpired(job.brandId, platform);
      return giveUp(db, job.orgId, job.brandId, draftId, `token_expired:${platform}`);
    }
  }

  await progress(60, "publish");
  try {
    const result = await publishPost(
      platform,
      { accessToken, externalAccountId: conn.externalAccountId },
      { text: composePost(draft.hook, draft.body), imageUrl: draft.imageUrl },
    );
    await org.markDraftPublished(job.brandId, draftId, result);
    log.info("publish.ok", { draftId, platform, externalPostId: result.externalPostId });
    return { published: true, platform, externalPostId: result.externalPostId, externalUrl: result.externalUrl };
  } catch (e) {
    const err = e instanceof PublishError ? e : new PublishError(e instanceof Error ? e.message : String(e), { retryable: false });
    if (err.authInvalid) await org.markConnectionExpired(job.brandId, platform);
    if (!err.retryable) return giveUp(db, job.orgId, job.brandId, draftId, err.message);
    // Transient. `attempts` was incremented at claim time, so this attempt is
    // the last one exactly when attempts >= maxAttempts.
    if (job.attempts >= job.maxAttempts) {
      await org.markDraftPublishFailed(job.brandId, draftId, err.message);
    }
    throw err;
  }
};
