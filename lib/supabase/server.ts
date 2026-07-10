import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Thin Supabase server client (Stage 1). Returns null when Supabase env is
 * unset so the app boots without it. The full auth flow (email + Google +
 * LinkedIn) lands in M2 per docs/PLAN.md.
 */
export async function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — safe to ignore; middleware refreshes sessions.
        }
      },
    },
  });
}
