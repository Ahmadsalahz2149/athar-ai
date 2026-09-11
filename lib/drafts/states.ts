/**
 * Draft lifecycle states (A6: English enum values only — never display strings).
 *
 * The split matters: a server action's parameter type is a compile-time promise
 * only, and server actions are callable directly. Before publishing existed, a
 * forged status was cosmetic. Now `published` is a claim that a post is live on
 * a platform — with a link the calendar renders — so the publisher must be the
 * only thing that can write it.
 */
export const DRAFT_STATUSES = [
  "draft",
  "pending",
  "approved",
  "needs_edit",
  "scheduled",
  "rejected",
  // Publisher-owned, below.
  "publishing",
  "published",
  "publish_failed",
] as const;

export type DraftStatus = (typeof DRAFT_STATUSES)[number];

/** States a signed-in user may set directly, from the Studio or Approvals. */
export const USER_SETTABLE_STATUSES = [
  "draft",
  "pending",
  "approved",
  "needs_edit",
  "scheduled",
  "rejected",
] as const satisfies readonly DraftStatus[];

export type UserSettableStatus = (typeof USER_SETTABLE_STATUSES)[number];

export function isUserSettableStatus(s: string): s is UserSettableStatus {
  return (USER_SETTABLE_STATUSES as readonly string[]).includes(s);
}
