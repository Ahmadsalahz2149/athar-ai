"use server";

import { revalidatePath } from "next/cache";
import { currentAdmin } from "@/lib/auth/admin";
import * as admin from "@/lib/db/admin";

async function guard() {
  const me = await currentAdmin();
  if (!me) throw new Error("forbidden");
  return me;
}

export async function adjustCreditsAction(orgId: string, delta: number, note: string): Promise<{ ok: boolean; balance?: number; error?: string }> {
  try {
    await guard();
    if (!Number.isFinite(delta) || delta === 0) return { ok: false, error: "bad_amount" };
    const balance = await admin.adjustCredits(orgId, Math.trunc(delta), note);
    revalidatePath(`/admin/accounts/${orgId}`);
    revalidatePath("/admin/accounts");
    return { ok: true, balance };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}

export async function toggleSuspendAction(orgId: string, suspend: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    await admin.setSuspended(orgId, suspend);
    revalidatePath(`/admin/accounts/${orgId}`);
    revalidatePath("/admin/accounts");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}

export async function createCouponAction(input: { code: string; credits: number; maxRedemptions: number; expiresAt?: string | null }): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    const code = input.code?.trim();
    if (!code || input.credits <= 0 || input.maxRedemptions <= 0) return { ok: false, error: "bad_input" };
    await admin.createCoupon({
      code,
      credits: Math.trunc(input.credits),
      maxRedemptions: Math.trunc(input.maxRedemptions),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });
    revalidatePath("/admin/coupons");
    return { ok: true };
  } catch (e) {
    // Unique code collision surfaces here.
    return { ok: false, error: e instanceof Error && /duplicate|unique/i.test(e.message) ? "code_exists" : "failed" };
  }
}

export async function toggleCouponAction(id: string, active: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    await admin.setCouponActive(id, active);
    revalidatePath("/admin/coupons");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}
