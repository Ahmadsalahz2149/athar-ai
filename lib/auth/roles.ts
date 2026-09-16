/**
 * Workspace roles and what each one may do (Phase 4: agency readiness).
 *
 * Pure — no DB, no session — so the permission matrix is a table you can read
 * in one screen and a test can assert exhaustively. Authorization that is
 * scattered across twenty server actions is authorization nobody can audit,
 * and the failure mode is silent: a role gains a power nobody meant to give it
 * and no test notices.
 *
 * Three roles, matching what an agency actually has: the person who pays, the
 * person who writes, and the client-side person who says yes.
 */

export const ROLES = ["owner", "editor", "reviewer"] as const;
export type Role = (typeof ROLES)[number];

/** Roles that can be handed out in an invitation. `owner` is not among them:
 * ownership carries billing and workspace deletion, and is transferred
 * deliberately, never granted by an email link. */
export const INVITABLE_ROLES = ["editor", "reviewer"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export type Capability =
  /** Create and edit content: drafts, sources, media, the brand profile. */
  | "content.write"
  /** Destroy content: sources, assets, products, distribution groups. */
  | "content.delete"
  /** Move a draft through review — approve, reject, ask for edits. */
  | "approve"
  /** Put a post on a real platform, now or on a schedule. */
  | "publish"
  /** Connect or disconnect the workspace's social accounts. */
  | "connect"
  /** Buy credits, change the subscription, open the billing portal. */
  | "billing"
  /** Invite, remove, and re-role teammates. */
  | "team"
  /** Erase the workspace and everything in it. */
  | "workspace.delete";

const MATRIX: Record<Role, readonly Capability[]> = {
  // The person who pays. Everything, including the two that end things:
  // billing and erasure.
  owner: ["content.write", "content.delete", "approve", "publish", "connect", "billing", "team", "workspace.delete"],
  // The person who does the work. Everything about the content, nothing about
  // the account — an agency's writer should not be able to change the plan or
  // delete the workspace by misclicking.
  editor: ["content.write", "content.delete", "approve", "publish", "connect"],
  // The end client. They are here to say yes or no to posts, and a review link
  // should never become a way into someone's sources or billing.
  reviewer: ["approve"],
};

/** Unknown roles are treated as the most restricted one rather than rejected,
 * so a row written by a future version can never be read as more power than it
 * was meant to carry. */
export function asRole(raw: unknown): Role {
  return typeof raw === "string" && (ROLES as readonly string[]).includes(raw) ? (raw as Role) : "reviewer";
}

export function can(role: Role | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  return MATRIX[asRole(role)].includes(cap);
}

/** Every capability a role holds — for rendering a permissions summary. */
export function capabilitiesOf(role: Role): readonly Capability[] {
  return MATRIX[asRole(role)];
}

/** True when `actor` may change or remove a member holding `target`'s role.
 * Nobody demotes or removes an owner through the team screen: the only way an
 * owner leaves is by transferring ownership or erasing the workspace, both of
 * which are deliberate acts elsewhere. */
export function canManageMember(actor: Role, target: Role): boolean {
  return can(actor, "team") && target !== "owner";
}
