import crypto from "node:crypto";

/**
 * Bearer tokens that are handed to a person and stored as a hash.
 *
 * Two features need exactly this shape — a team invitation and a client review
 * link — and both are credentials: whoever holds the string gets in. So they
 * share one implementation with one set of properties: 32 bytes of CSPRNG
 * entropy, URL-safe, and only ever persisted as a SHA-256. The raw value exists
 * in the link and nowhere else, so a database dump does not hand anyone access.
 */

export function newToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
