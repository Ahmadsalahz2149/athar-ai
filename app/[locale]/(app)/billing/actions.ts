"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";

/** Redeem a coupon code for credits (Phase 4 #24). Real — no payment gateway
 * needed; the code grants credits directly. */
export async function redeemCoupon(code: string): Promise<{ ok: true; credits: number; balance: number } | { ok: false; error: string }> {
  try {
    if (!code?.trim()) return { ok: false, error: "invalid" };
    if (!db) return { ok: false, error: "no_session" };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };
    const r = await forOrg(db, ctx.orgId).redeemCoupon(code);
    if (r.ok) revalidatePath("/billing");
    return r;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
