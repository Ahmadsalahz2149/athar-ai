import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { asSystem } from "@/lib/db/rls";
import { isUniqueViolation } from "@/lib/db/pg-errors";
import { hashInviteToken, normalizeEmail } from "./invite-token";
import { asRole, type Role } from "./roles";

/**
 * Redeeming an invitation (Phase 4).
 *
 * Deliberately OUTSIDE the forOrg façade, and allowlisted in eslint.config.mjs
 * for the same reason the public link page is: there is no org to scope to. The
 * person accepting is not a member of that workspace yet — that is the entire
 * point of the operation — so the token IS the lookup key and the read has to
 * be able to find a row in an org the caller currently has no relationship
 * with. Every write below is still bounded to the single invitation row the
 * token resolved to.
 */

export type AcceptResult =
  | { ok: true; orgId: string; role: Role; alreadyMember: boolean }
  | { ok: false; reason: "invalid" | "expired" | "revoked" | "accepted" | "wrong_email" | "owner_elsewhere" | "no_db" };

/**
 * Take the seat an invitation offers.
 *
 * The email check is the part that matters. Without it the link alone is the
 * credential, and a forwarded invitation would let whoever received it into a
 * client's workspace. With it, the link must be redeemed by the person it was
 * addressed to.
 */
export async function acceptInvitation(token: string, user: { id: string; email?: string | null }): Promise<AcceptResult> {
  if (!db) return { ok: false, reason: "no_db" };
  if (!token) return { ok: false, reason: "invalid" };

  const rows = await asSystem(db, (tx) => tx
    .select({
      id: schema.invitations.id,
      orgId: schema.invitations.orgId,
      email: schema.invitations.email,
      role: schema.invitations.role,
      expiresAt: schema.invitations.expiresAt,
      acceptedAt: schema.invitations.acceptedAt,
      revokedAt: schema.invitations.revokedAt,
    })
    .from(schema.invitations)
    .where(eq(schema.invitations.tokenHash, hashInviteToken(token)))
    .limit(1));

  const inv = rows[0];
  if (!inv) return { ok: false, reason: "invalid" };
  if (inv.revokedAt) return { ok: false, reason: "revoked" };
  if (inv.acceptedAt) return { ok: false, reason: "accepted" };
  if (inv.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };

  const signedInAs = normalizeEmail(user.email ?? "");
  if (!signedInAs || signedInAs !== normalizeEmail(inv.email)) return { ok: false, reason: "wrong_email" };

  const role = asRole(inv.role);
  // An invitation never grants ownership — `INVITABLE_ROLES` keeps that out of
  // the UI, and this keeps it out of a row written by anything else.
  if (role === "owner") return { ok: false, reason: "invalid" };

  // Claim the invitation and create the seat in ONE transaction. Two statements
  // would leave a window where the invitation is spent and the membership never
  // landed, which reads to the user as a dead link and to the owner as a used
  // seat that nobody occupies.
  try {
    const claimed = await asSystem(db, async (tx) => {
      const marked = await tx
        .update(schema.invitations)
        .set({ acceptedAt: new Date(), acceptedBy: user.id })
        .where(and(
          eq(schema.invitations.id, inv.id),
          isNull(schema.invitations.acceptedAt),
          isNull(schema.invitations.revokedAt),
          sql`${schema.invitations.expiresAt} > now()`,
        ))
        .returning({ id: schema.invitations.id });
      // Someone else redeemed it between the read and here.
      if (!marked.length) return null;

      const seat = await tx
        .insert(schema.memberships)
        .values({ userId: user.id, orgId: inv.orgId, role, email: normalizeEmail(inv.email) })
        .onConflictDoNothing({ target: [schema.memberships.userId, schema.memberships.orgId] })
        .returning({ id: schema.memberships.id });

      return { alreadyMember: seat.length === 0 };
    });

    if (!claimed) return { ok: false, reason: "accepted" };
    return { ok: true, orgId: inv.orgId, role, alreadyMember: claimed.alreadyMember };
  } catch (e) {
    // The only unique index that can fire here is the one-owned-workspace rule,
    // and only if a row claimed role 'owner' — which the check above forbids.
    if (isUniqueViolation(e)) return { ok: false, reason: "owner_elsewhere" };
    throw e;
  }
}

/** The workspace an invitation is for, without spending it — so the accept page
 * can say whose team the person is joining before they commit. Returns only
 * what is safe to show someone holding the link. */
export async function peekInvitation(token: string): Promise<
  { ok: true; orgName: string; email: string; role: Role } | { ok: false; reason: "invalid" | "expired" | "revoked" | "accepted" | "no_db" }
> {
  if (!db) return { ok: false, reason: "no_db" };
  if (!token) return { ok: false, reason: "invalid" };

  const rows = await asSystem(db, (tx) => tx
    .select({
      email: schema.invitations.email,
      role: schema.invitations.role,
      expiresAt: schema.invitations.expiresAt,
      acceptedAt: schema.invitations.acceptedAt,
      revokedAt: schema.invitations.revokedAt,
      orgName: schema.organizations.name,
    })
    .from(schema.invitations)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.invitations.orgId))
    .where(eq(schema.invitations.tokenHash, hashInviteToken(token)))
    .limit(1));

  const inv = rows[0];
  if (!inv) return { ok: false, reason: "invalid" };
  if (inv.revokedAt) return { ok: false, reason: "revoked" };
  if (inv.acceptedAt) return { ok: false, reason: "accepted" };
  if (inv.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };

  return { ok: true, orgName: inv.orgName, email: inv.email, role: asRole(inv.role) };
}
