import "server-only";
import dns from "node:dns/promises";
import { extractPdfText } from "./extractPdf";
import { isPrivateIp, assertSafeUrl } from "./ssrf";

/**
 * SSRF-safe URL fetch (RISKS #8). Guards: https/http only, standard ports,
 * internal hostnames + DNS-resolved private/loopback/link-local IPs blocked, one
 * re-validated redirect hop, size cap + timeout. Pure checks live in ssrf.ts.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 12000;

async function assertPublicDns(hostname: string): Promise<void> {
  // Literal IPs / internal names are handled by assertSafeUrl; here we resolve
  // real hostnames and reject any private/loopback answer.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) return;
  const addrs = await dns.lookup(hostname, { all: true });
  if (!addrs.length) throw new Error("DNS resolution failed");
  for (const a of addrs) if (isPrivateIp(a.address)) throw new Error("host resolves to a private address");
}

export async function fetchUrlText(rawUrl: string): Promise<{ text: string; title: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("invalid URL");
  }
  assertSafeUrl(url);
  await assertPublicDns(url.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers = {
    "user-agent": "AtharBot/1.0 (+content ingestion)",
    accept: "text/html,application/pdf,text/plain,*/*",
  };
  try {
    let res = await fetch(url, { redirect: "manual", signal: controller.signal, headers });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("redirect without location");
      url = new URL(loc, url);
      assertSafeUrl(url);
      await assertPublicDns(url.hostname);
      res = await fetch(url, { redirect: "error", signal: controller.signal, headers });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error("content too large");
    const ct = (res.headers.get("content-type") || "").toLowerCase();

    if (ct.includes("application/pdf") || url.pathname.toLowerCase().endsWith(".pdf")) {
      return { text: await extractPdfText(buf), title: fileNameOf(url) };
    }
    const raw = new TextDecoder("utf-8").decode(buf);
    if (ct.includes("text/html") || /<html[\s>]|<!doctype html/i.test(raw.slice(0, 500))) {
      return { text: htmlToText(raw), title: htmlTitle(raw) || url.hostname };
    }
    return { text: raw.trim(), title: url.hostname };
  } finally {
    clearTimeout(timer);
  }
}

function fileNameOf(u: URL): string {
  return decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || u.hostname);
}
function htmlTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
