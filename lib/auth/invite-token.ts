import crypto from "node:crypto";

/**
 * Invitation tokens (Phase 4).
 *
 * Pure and DB-free so every rule about what a token is and when it is still
 * good can be tested directly.
 *
 * The token is a bearer credential: whoever holds the link gets a seat in
 * someone's workspace. So it is treated like one — 32 bytes of CSPRNG entropy,
 * and only its SHA-256 is ever stored. The raw value exists in the link the
 * inviter sends and nowhere else, which means a database dump does not hand
 * anyone a way in.
 */

/** How long an invitation stays valid. Long enough to survive a weekend and a
 * forwarded email; short enough that a link found in an old inbox is dead. */
export const INVITE_TTL_DAYS = 7;

export function newInviteToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Normalize an email the same way on both sides of the invitation, so the
 * address that was invited is the address that can accept. Without this,
 * `Ahmad@Example.com ` in the invite never matches `ahmad@example.com` at
 * sign-in and the seat can never be taken. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Deliberately conservative: this only has to reject typos and junk, and a
 * clever regex that rejects a real address is worse than a loose one that
 * accepts a bad one — the invitation simply never gets accepted. */
export function isEmailish(raw: string): boolean {
  const e = normalizeEmail(raw);
  return e.length >= 5 && e.length <= 200 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e);
}

export type InviteState = "pending" | "accepted" | "revoked" | "expired";

export type InviteRow = {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
};

/**
 * What an invitation currently is.
 *
 * Order matters: an invitation that was revoked AND has since expired reports
 * `revoked`, because that is the fact the workspace owner acted on and the one
 * they need to see on the team screen.
 */
export function inviteState(row: InviteRow, now: Date = new Date()): InviteState {
  if (row.revokedAt) return "revoked";
  if (row.acceptedAt) return "accepted";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}

export function isRedeemable(row: InviteRow, now: Date = new Date()): boolean {
  return inviteState(row, now) === "pending";
}
