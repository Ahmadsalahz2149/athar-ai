"use server";

import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";

/** Disconnect a social platform (Phase 7.3): removes the stored OAuth tokens. */
export async function disconnectPlatform(platform: string): Promise<{ ok: boolean }> {
  try {
    if (!db) return { ok: false };
    const ctx = await currentContext();
    if (!ctx) return { ok: false };
    await forOrg(db, ctx.orgId).deleteConnection(ctx.brandId, platform);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
