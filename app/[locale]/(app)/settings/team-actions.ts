"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { requireCap } from "@/lib/auth/guard";
import { currentContext } from "@/lib/auth/current";
import { resolveUserEmails } from "@/lib/supabase/admin";
import { consume } from "@/lib/rate-limit";
import { INVITABLE_ROLES, asRole, canManageMember, type Role } from "@/lib/auth/roles";
import { hashInviteToken, inviteExpiry, inviteState, isEmailish, newInviteToken, normalizeEmail } from "@/lib/auth/invite-token";
import { log } from "@/lib/log";

/**
 * Team seats (Phase 4). Multi-brand already worked; what an agency could not do
 * was put a second person in the workspace.
 */

export type Member = { userId: string; role: Role; email: string | null; you: boolean; manageable: boolean; joinedAt: string };
export type Invite = { id: string; email: string; role: Role; state: "pending" | "accepted" | "revoked" | "expired"; createdAt: string };
export type TeamView = { ok: true; role: Role; members: Member[]; invites: Invite[] } | { ok: false; error: string };

/** How many seats one workspace may invite in an hour. An invitation link is a
 * credential someone else receives, so the rate limit is about not turning the
 * product into a way to mail strangers, not about load. */
const INVITES_PER_HOUR = 20;

export async function teamView(): Promise<TeamView> {
  try {
    if (!db) return { ok: false, error: "no_session" };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };

    const org = forOrg(db, ctx.orgId);
    const [rows, invites] = await Promise.all([org.members(), org.listInvitations()]);

    // Seats taken before the email column existed still have to name someone.
    const missing = rows.filter((m) => !m.email).map((m) => m.userId);
    const resolved = missing.length ? await resolveUserEmails(missing) : new Map<string, string>();

    const me = asRole(ctx.role);
    return {
      ok: true,
      role: me,
      members: rows.map((m) => {
        const role = asRole(m.role);
        return {
          userId: m.userId,
          role,
          email: m.email ?? resolved.get(m.userId) ?? null,
          you: m.userId === ctx.userId,
          manageable: canManageMember(me, role) && m.userId !== ctx.userId,
          joinedAt: m.createdAt.toISOString(),
        };
      }),
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: asRole(i.role),
        state: inviteState(i),
        createdAt: i.createdAt.toISOString(),
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}

export type InviteResult =
  | { ok: true; url: string; email: string }
  | { ok: false; error: "no_session" | "forbidden" | "bad_email" | "bad_role" | "already_member" | "already_invited" | "rate_limited" | "failed" };

/**
 * Create a seat invitation and return the link.
 *
 * The product does not send the email itself, and that is deliberate rather
 * than unfinished: outbound mail is not configured yet, and an invitation that
 * silently fails to arrive is worse than no invitation — the owner waits for a
 * colleague who was never contacted. Handing back a link the owner sends
 * themselves is honest about who delivers it, and works today.
 */
export async function inviteMember(emailRaw: string, roleRaw: string, origin?: string): Promise<InviteResult> {
  try {
    if (!db) return { ok: false, error: "no_session" };
    const gate = await requireCap("team");
    if (!gate.ok) return { ok: false, error: gate.error };

    const email = normalizeEmail(emailRaw ?? "");
    if (!isEmailish(email)) return { ok: false, error: "bad_email" };
    if (!(INVITABLE_ROLES as readonly string[]).includes(roleRaw)) return { ok: false, error: "bad_role" };

    if (!consume(`invite:${gate.orgId}`, INVITES_PER_HOUR, 60 * 60_000).ok) return { ok: false, error: "rate_limited" };

    const org = forOrg(db, gate.orgId);
    // Someone already holding a seat does not need a second one, and issuing a
    // live token for them would just be another way in.
    if ((await org.members()).some((m) => (m.email ?? "").toLowerCase() === email)) {
      return { ok: false, error: "already_member" };
    }
    if (await org.pendingInvitationFor(email)) return { ok: false, error: "already_invited" };

    // The raw token exists here and in the link. Only its hash is stored.
    const token = newInviteToken();
    await org.createInvitation({
      email,
      role: roleRaw,
      tokenHash: hashInviteToken(token),
      invitedBy: gate.userId,
      expiresAt: inviteExpiry(),
    });

    log.info("team.invited", { orgId: gate.orgId, role: roleRaw });
    return { ok: true, email, url: `${(origin ?? "").replace(/\/+$/, "")}/invite/${token}` };
  } catch (e) {
    log.error("team.invite_failed", { error: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: "failed" };
  }
}

export async function revokeInvite(invitationId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!db) return { ok: false, error: "no_session" };
    const gate = await requireCap("team");
    if (!gate.ok) return { ok: false, error: gate.error };
    const done = await forOrg(db, gate.orgId).revokeInvitation(invitationId);
    revalidatePath("/[locale]/(app)/settings", "page");
    return done ? { ok: true } : { ok: false, error: "not_found" };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function changeMemberRole(userId: string, roleRaw: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!db) return { ok: false, error: "no_session" };
    const gate = await requireCap("team");
    if (!gate.ok) return { ok: false, error: gate.error };
    if (!(INVITABLE_ROLES as readonly string[]).includes(roleRaw)) return { ok: false, error: "bad_role" };
    // Changing your own role is how someone locks themselves out of their own
    // workspace in one click.
    if (userId === gate.userId) return { ok: false, error: "not_yourself" };

    const done = await forOrg(db, gate.orgId).setMemberRole(userId, roleRaw);
    revalidatePath("/[locale]/(app)/settings", "page");
    return done ? { ok: true } : { ok: false, error: "not_found" };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function removeMember(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!db) return { ok: false, error: "no_session" };
    const gate = await requireCap("team");
    if (!gate.ok) return { ok: false, error: gate.error };
    if (userId === gate.userId) return { ok: false, error: "not_yourself" };

    const done = await forOrg(db, gate.orgId).removeMember(userId);
    revalidatePath("/[locale]/(app)/settings", "page");
    return done ? { ok: true } : { ok: false, error: "not_found" };
  } catch {
    return { ok: false, error: "failed" };
  }
}
