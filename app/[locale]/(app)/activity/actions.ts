"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { pumpWorker } from "../ingest/actions";

/** Retry a failed/dead operation and immediately drive the worker (Creation
 * Center). Serverless has no always-on worker, so we pump it here. */
export async function retryJob(jobId: string): Promise<{ ok: boolean }> {
  try {
    if (!db) return { ok: false };
    const ctx = await currentContext();
    if (!ctx) return { ok: false };
    const reset = await forOrg(db, ctx.orgId).retryJob(ctx.brandId, jobId);
    if (reset) {
      await pumpWorker().catch(() => {});
      revalidatePath("/activity");
    }
    return { ok: reset };
  } catch {
    return { ok: false };
  }
}
