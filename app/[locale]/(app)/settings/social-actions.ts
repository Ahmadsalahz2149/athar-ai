"use server";

import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { requireCap } from "@/lib/auth/guard";

/** Disconnect a social platform (Phase 7.3): removes the stored OAuth tokens. */
export async function disconnectPlatform(platform: string): Promise<{ ok: boolean }> {
  try {
    if (!db) return { ok: false };
    // Disconnecting takes the whole workspace off a platform, not just the
    // person clicking — it belongs with the account, not with content work.
    const gate = await requireCap("connect");
    if (!gate.ok) return { ok: false };
    const ctx = gate;
    await forOrg(db, ctx.orgId).deleteConnection(ctx.brandId, platform);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
