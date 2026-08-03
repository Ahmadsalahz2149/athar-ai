import "server-only";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { ensureUserContext } from "./bootstrap";

/** The signed-in user's {orgId, brandId}, or null if unauthenticated / no DB.
 * Honors the `active_brand` cookie for multi-brand switching, falling back to
 * the default brand when the cookie is missing or points at another org's brand. */
export async function currentContext(): Promise<{ orgId: string; brandId: string } | null> {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const ctx = await ensureUserContext(user.id, user.email ?? undefined);
  if (!ctx || !db) return ctx;

  // Multi-brand: if the user selected another brand, use it (must belong to org).
  const active = (await cookies()).get("active_brand")?.value;
  if (active && active !== ctx.brandId) {
    const b = await forOrg(db, ctx.orgId).getBrand(active);
    if (b) return { orgId: ctx.orgId, brandId: active };
  }
  return ctx;
}
