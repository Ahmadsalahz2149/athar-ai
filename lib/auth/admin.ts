import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getAdminRow, ensureAdminRow } from "@/lib/db/admin";

/** Emails allowed to bootstrap admin access, from the ADMIN_EMAILS env var
 * (comma-separated). The first admin(s) come from here; more can be promoted
 * from within the panel (which writes platform_admins rows). */
function adminAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export type AdminIdentity = { userId: string; email?: string };

/** The current platform admin, or null. Access is granted when the signed-in
 * user's email is in ADMIN_EMAILS (env allowlist) OR a platform_admins row
 * exists for them. An allowlisted user is auto-recorded in platform_admins so
 * they show up in the panel's admin list. */
export async function currentAdmin(): Promise<AdminIdentity | null> {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const email = user.email?.toLowerCase();
  const allowlisted = !!email && adminAllowlist().includes(email);
  if (allowlisted) {
    await ensureAdminRow(user.id, user.email ?? undefined).catch(() => {});
    return { userId: user.id, email: user.email ?? undefined };
  }
  const row = await getAdminRow(user.id).catch(() => null);
  if (row) return { userId: user.id, email: user.email ?? undefined };
  return null;
}

/** True if the current user is a platform admin (cheap boolean for nav gating). */
export async function isCurrentUserAdmin(): Promise<boolean> {
  return (await currentAdmin()) !== null;
}
