import "server-only";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { ensureUserContext } from "./bootstrap";
import type { Role } from "./roles";

/** The signed-in user's {orgId, brandId, role}, or null if unauthenticated / no
 * DB. Honors the `active_brand` cookie for multi-brand switching, falling back
 * to the default brand when the cookie is missing or points at another org's
 * brand.
 *
 * `role` is the user's role IN THIS WORKSPACE (Phase 4). It rides along with
 * the context rather than being looked up separately so that every guarded
 * action authorizes against the same org it is about to write to — a role
 * fetched independently of the org is the classic way a permission check ends
 * up answering a question nobody asked. */
export async function currentContext(): Promise<{ userId: string; orgId: string; brandId: string; role: Role } | null> {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const base = await ensureUserContext(user.id, user.email ?? undefined);
  if (!base) return null;
  const ctx = { userId: user.id, ...base };
  if (!db) return ctx;

  // Multi-brand: if the user selected another brand, use it (must belong to org).
  const active = (await cookies()).get("active_brand")?.value;
  if (active && active !== ctx.brandId) {
    const b = await forOrg(db, ctx.orgId).getBrand(active);
    if (b) return { ...ctx, brandId: active };
  }
  return ctx;
}
