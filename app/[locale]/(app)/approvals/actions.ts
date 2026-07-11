"use server";

import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";

/** Set a draft's approval status. `schedule` stamps scheduledAt = now (MVP slot). */
export async function setDraftStatus(
  draftId: string,
  status: "approved" | "needs_edit" | "scheduled" | "published",
  schedule = false,
): Promise<{ ok: boolean }> {
  try {
    if (!db) return { ok: false };
    const ctx = await currentContext();
    if (!ctx) return { ok: false };
    await forOrg(db, ctx.orgId).setDraftStatus(ctx.brandId, draftId, status, schedule ? new Date() : undefined);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function approveAll(): Promise<{ ok: boolean; n: number }> {
  try {
    if (!db) return { ok: false, n: 0 };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, n: 0 };
    const t = forOrg(db, ctx.orgId);
    const pending = await t.listDraftsByStatus(ctx.brandId, "pending");
    const now = new Date();
    for (const d of pending) await t.setDraftStatus(ctx.brandId, d.id, "scheduled", now);
    return { ok: true, n: pending.length };
  } catch {
    return { ok: false, n: 0 };
  }
}
