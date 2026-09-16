/**
 * Where to send someone after they sign in (Phase 4).
 *
 * Pure, and tested, because "?next=" is one of the classic ways a login page
 * becomes an open redirect: a link that looks like it goes to athargrowth.com
 * lands on an attacker's copy of the sign-in screen, with the user's trust
 * already spent. So nothing is trusted except a path on this very site.
 *
 * Rejected: absolute URLs, protocol-relative "//host" (a browser reads that as
 * another origin), backslash variants that some parsers normalize to slashes,
 * and anything not starting with a single slash.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (v.length > 512) return null;
  if (!v.startsWith("/")) return null;
  // "//evil.com" and "/\evil.com" both leave this origin.
  if (v.startsWith("//")) return null;
  if (v.includes("\\")) return null;
  // A scheme anywhere means it is not a plain path.
  if (/^[a-z][a-z0-9+.-]*:/i.test(v.slice(1))) return null;
  // Control characters, which some clients strip before following the URL.
  if (/[\x00-\x1f\x7f]/.test(v)) return null;
  return v;
}
