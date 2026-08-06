"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";

/** Mark a learning-center lesson complete (Phase 4 #18). */
export async function completeLesson(lessonId: string): Promise<{ ok: boolean }> {
  try {
    if (!db) return { ok: false };
    const ctx = await currentContext();
    if (!ctx) return { ok: false };
    await forOrg(db, ctx.orgId).completeLesson(lessonId);
    revalidatePath("/help");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
