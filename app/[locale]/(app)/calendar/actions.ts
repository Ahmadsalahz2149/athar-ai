"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";

/** Schedule one approved draft at an explicit datetime (from the calendar UI). */
export async function scheduleDraft(draftId: string, iso: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!db) return { ok: false, error: "no_session" };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) return { ok: false, error: "bad_date" };
    await forOrg(db, ctx.orgId).setDraftStatus(ctx.brandId, draftId, "scheduled", when);
    revalidatePath("/[locale]/(app)/calendar", "page");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}

/** Auto-schedule every approved draft: one per day starting tomorrow at a
 * best-time slot (10:00 local), spreading them across upcoming days. */
export async function autoScheduleApproved(baseIso: string): Promise<{ ok: boolean; scheduled: number; error?: string }> {
  try {
    if (!db) return { ok: false, scheduled: 0, error: "no_session" };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, scheduled: 0, error: "no_session" };
    const org = forOrg(db, ctx.orgId);
    const approved = await org.listDraftsByStatus(ctx.brandId, "approved");
    // baseIso is "today" computed on the client (server has no Date.now via our rules elsewhere,
    // but server actions may use Date). We derive successive days from it.
    const base = new Date(baseIso);
    if (Number.isNaN(base.getTime())) return { ok: false, scheduled: 0, error: "bad_date" };
    let i = 1;
    for (const d of approved) {
      const when = new Date(base);
      when.setDate(base.getDate() + i);
      when.setHours(10, 0, 0, 0);
      await org.setDraftStatus(ctx.brandId, d.id, "scheduled", when);
      i++;
    }
    revalidatePath("/[locale]/(app)/calendar", "page");
    return { ok: true, scheduled: approved.length };
  } catch (e) {
    return { ok: false, scheduled: 0, error: e instanceof Error ? e.message : "failed" };
  }
}
