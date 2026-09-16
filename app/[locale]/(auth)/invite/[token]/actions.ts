"use server";

import { getSupabaseServer } from "@/lib/supabase/server";
import { acceptInvitation } from "@/lib/auth/invites";
import { clientIp } from "@/lib/request-ip";
import { consume } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export type AcceptOutcome = { ok: true } | { ok: false; error: string };

/**
 * Take the seat an invitation offers.
 *
 * Rate-limited by IP because the token is a bearer credential: without a limit
 * this action is an oracle you can grind against, and 32 bytes of entropy is
 * only worth what the guessing budget lets you spend.
 */
export async function acceptInvite(token: string): Promise<AcceptOutcome> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: false, error: "no_session" };
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, error: "no_session" };

  if (!consume(`invite-accept:${await clientIp()}`, 20, 10 * 60_000).ok) return { ok: false, error: "rate_limited" };

  const res = await acceptInvitation(token, { id: user.id, email: user.email });
  if (!res.ok) return { ok: false, error: res.reason };
  log.info("team.invite_accepted", { orgId: res.orgId, role: res.role, alreadyMember: res.alreadyMember });
  return { ok: true };
}
