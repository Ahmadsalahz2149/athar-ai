/** Pure SSRF guards (no server-only, no I/O) so they're unit-testable. The
 * DNS-resolution step lives in fetchUrl.ts and reuses isPrivateIp here. */

/** Normalize an address the way `URL.hostname` reports it: IPv6 literals come
 * back wrapped in brackets (`[::1]`) and may carry a `%zone` suffix. Comparing
 * without stripping those silently let every IPv6 literal through. */
function normalizeIp(ip: string): string {
  let s = ip.trim().toLowerCase();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  const zone = s.indexOf("%");
  if (zone !== -1) s = s.slice(0, zone);
  return s;
}

export function isPrivateIp(ip: string): boolean {
  const s = normalizeIp(ip);

  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
    const o = s.split(".").map(Number);
    if (o.some((n) => n > 255)) return true; // malformed → block
    const [a, b] = o;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local (cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true; // 192.0.0.0/24 + TEST-NET-1
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast, reserved, broadcast
    return false;
  }

  // IPv6
  if (s.includes(":")) {
    if (s === "::1" || s === "::") return true; // loopback / unspecified
    // v4-mapped: dotted (::ffff:169.254.169.254) and the compressed hex form
    // the URL parser produces (::ffff:a9fe:a9fe).
    const mapped = /^::ffff:(.+)$/.exec(s);
    if (mapped) {
      const t = mapped[1];
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) return isPrivateIp(t);
      const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(t);
      if (hex) {
        const n = ((parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16)) >>> 0;
        return isPrivateIp([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."));
      }
      return true; // unrecognized mapped form → block
    }
    const head = parseInt(s.split(":")[0], 16);
    if (Number.isNaN(head)) return true; // "::2" and friends → block
    if ((head & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
    if ((head & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((head & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
    if ((head & 0xff00) === 0xff00) return true; // ff00::/8 multicast
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
  // Literal IPs must be public. IPv6 literals arrive bracketed, so match on the
  // brackets too rather than only on a bare colon.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[")) {
    if (isPrivateIp(host)) throw new Error("blocked private address");
  }
}
