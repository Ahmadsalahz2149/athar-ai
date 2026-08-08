import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Service-role Supabase client for admin-only operations (resolving user
 * emails, etc.). Uses SUPABASE_SERVICE_ROLE_KEY — never expose to the client.
 * Returns null when unconfigured so callers degrade gracefully. */
let cached: SupabaseClient | null | undefined;
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return cached;
}

/** Map of Supabase user id → email, for the given user ids. Best-effort: returns
 * an empty map when the service client is unavailable. Paginates listUsers. */
export async function resolveUserEmails(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const admin = getSupabaseAdmin();
  if (!admin || userIds.length === 0) return out;
  const want = new Set(userIds);
  try {
    for (let page = 1; page <= 20 && want.size > 0; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        if (want.has(u.id) && u.email) {
          out.set(u.id, u.email);
          want.delete(u.id);
        }
      }
      if (data.users.length < 200) break;
    }
  } catch {
    /* best-effort */
  }
  return out;
}
