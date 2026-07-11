/** Pure SSRF guards (no server-only, no I/O) so they're unit-testable. The
 * DNS-resolution step lives in fetchUrl.ts and reuses isPrivateIp here. */

export function isPrivateIp(ip: string): boolean {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  // IPv6
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    if (l === "::1" || l === "::") return true;
    if (l.startsWith("fc") || l.startsWith("fd")) return true; // unique-local
    if (l.startsWith("fe80")) return true; // link-local
    if (l.startsWith("::ffff:")) return isPrivateIp(l.slice(7)); // v4-mapped
    return false;
  }
  return true; // unknown format → block
}

/** Validate protocol + port + obviously-internal hostnames. Throws on violation. */
export function assertSafeUrl(u: URL): void {
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("only http/https URLs are allowed");
  if (u.port && !["", "80", "443"].includes(u.port)) throw new Error("non-standard port not allowed");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("blocked internal host");
  }
  // Literal IPs must be public.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    if (isPrivateIp(host)) throw new Error("blocked private address");
  }
}
