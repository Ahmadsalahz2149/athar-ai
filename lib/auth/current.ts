import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ensureUserContext } from "./bootstrap";

/** The signed-in user's {orgId, brandId}, or null if unauthenticated / no DB. */
export async function currentContext(): Promise<{ orgId: string; brandId: string } | null> {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return ensureUserContext(user.id, user.email ?? undefined);
}
