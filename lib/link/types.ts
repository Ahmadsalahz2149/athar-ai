/** Public "link in bio" page (Phase 3 #17). Stored on brands.link_page. */

export type LinkItem = { label: string; url: string };
export type LinkPage = { headline: string; bio: string; links: LinkItem[] };

export const EMPTY_LINK_PAGE: LinkPage = { headline: "", bio: "", links: [] };

export function normalizeLinkPage(raw: unknown): LinkPage {
  const o = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const links = Array.isArray(o.links)
    ? (o.links as unknown[])
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((x) => ({ label: str(x.label).slice(0, 80), url: str(x.url).slice(0, 500) }))
        .filter((x) => x.label && x.url)
        .slice(0, 15)
    : [];
  return { headline: str(o.headline).slice(0, 120), bio: str(o.bio).slice(0, 400), links };
}

/** Normalize a user-entered handle to a safe slug, or "" if invalid/too short. */
export function normalizeHandle(raw: string): string {
  const h = raw.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
  return h.length >= 3 ? h : "";
}

/** Ensure a link URL is absolute (prepend https:// when the scheme is missing). */
export function safeUrl(url: string): string {
  const u = url.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (/^mailto:|^tel:/i.test(u)) return u;
  return `https://${u}`;
}
