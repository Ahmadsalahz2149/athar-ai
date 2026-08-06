"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { normalizeHandle, normalizeLinkPage, type LinkPage } from "@/lib/link/types";

type Res = { ok: true } | { ok: false; error: string };

/** Save the handle + link-page config. Validates the handle and enforces
 * uniqueness across brands. */
export async function saveMyLink(handleRaw: string, page: LinkPage): Promise<Res> {
  try {
    if (!db) return { ok: false, error: "no_session" };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };
    const t = forOrg(db, ctx.orgId);

    const handle = normalizeHandle(handleRaw);
    if (!handle) return { ok: false, error: "bad_handle" };
    const claimed = await t.setHandle(ctx.brandId, handle);
    if (!claimed) return { ok: false, error: "handle_taken" };

    await t.setLinkPage(ctx.brandId, normalizeLinkPage(page));
    revalidatePath("/mylink");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
