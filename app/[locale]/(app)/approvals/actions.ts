"use server";

import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { guardDraft } from "@/lib/ai/guardDraft";
import { isUserSettableStatus } from "@/lib/drafts/states";

/** Set a draft's approval status. `schedule` stamps scheduledAt = now (MVP slot). */
export async function setDraftStatus(
  draftId: string,
  status: "approved" | "needs_edit" | "scheduled" | "rejected",
  schedule = false,
): Promise<{ ok: boolean; error?: string; violations?: string[] }> {
  try {
    if (!db) return { ok: false };
    const ctx = await currentContext();
    if (!ctx) return { ok: false };
    // The union above is a compile-time promise; this action is callable
    // directly, so re-check it. "published" is deliberately not settable here —
    // only the publisher may claim a post is live.
    if (!isUserSettableStatus(status)) return { ok: false, error: "bad_status" };
    // Same server-side guardrail as Studio: approving/scheduling is the point of
    // no return, so re-scan the stored text here. Sending a draft back
    // (needs_edit / rejected) is always allowed.
    if (status === "approved" || status === "scheduled") {
      const guard = await guardDraft(db, ctx.orgId, ctx.brandId, draftId);
      if (!guard.ok) return { ok: false, error: "guardrail", violations: guard.violations };
    }
    await forOrg(db, ctx.orgId).setDraftStatus(ctx.brandId, draftId, status, schedule ? new Date() : undefined);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Save a reviewer note (reason for send-back / rejection) with a status change. */
export async function reviewDraft(
  draftId: string,
  status: "needs_edit" | "rejected",
  note: string,
): Promise<{ ok: boolean }> {
  try {
    if (!db) return { ok: false };
    const ctx = await currentContext();
    if (!ctx) return { ok: false };
    await forOrg(db, ctx.orgId).reviewDraft(ctx.brandId, draftId, status, note);
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
    let n = 0;
    for (const d of pending) {
      // Bulk approve must not become a way around the guardrail — skip drafts
      // that fail the scan and report only what was actually scheduled.
      const guard = await guardDraft(db, ctx.orgId, ctx.brandId, d.id);
      if (!guard.ok) continue;
      await t.setDraftStatus(ctx.brandId, d.id, "scheduled", now);
      n++;
    }
    return { ok: true, n };
  } catch {
    return { ok: false, n: 0 };
  }
}
