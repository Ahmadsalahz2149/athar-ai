import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP for rate-limiting keys.
 *
 * Production sits behind Cloudflare, so `cf-connecting-ip` is the trustworthy
 * value; the `x-forwarded-for` fallbacks exist for local/dev and are spoofable
 * by anyone who reaches the origin directly. That is acceptable for a
 * throttle (worst case an attacker rotates keys and is limited per-email
 * instead), but it must never be treated as identity for authorization.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}
