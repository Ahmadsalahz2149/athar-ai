/** Distribution hub (Phase 2) — the AI-derived audience understanding + the
 * group-search keywords/queries it produces. Cached on brands.distribution and
 * regenerated on demand from the DNA + brand profile + products. */

export type AudienceProfile = {
  summary: string;          // one-paragraph who-they-are
  segments: string[];       // distinct sub-audiences
  demographics: string;     // age / location / role / language
  interests: string[];      // what they follow / care about
  painPoints: string[];     // problems the brand solves for them
  wateringHoles: string[];  // the kinds of communities/groups where they gather
};

/** A ready-to-run search query for finding groups on a specific platform. */
export type GroupQuery = { platform: string; query: string };

export type DistributionKit = {
  audience: AudienceProfile;
  keywords: string[];       // short search keywords/phrases
  queries: GroupQuery[];    // platform-specific group-search queries
  generatedAt: string | null;
};

export const EMPTY_AUDIENCE: AudienceProfile = {
  summary: "", segments: [], demographics: "", interests: [], painPoints: [], wateringHoles: [],
};

export const EMPTY_KIT: DistributionKit = {
  audience: EMPTY_AUDIENCE, keywords: [], queries: [], generatedAt: null,
};

export const GROUP_PLATFORMS = ["facebook", "linkedin", "telegram", "reddit", "whatsapp"] as const;
export type GroupPlatform = (typeof GROUP_PLATFORMS)[number];

export function normalizeKit(raw: unknown): DistributionKit {
  const o = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const arr = (v: unknown, max = 30) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, max) : []);
  const a = (o.audience ?? {}) as Record<string, unknown>;
  const queries = Array.isArray(o.queries)
    ? (o.queries as unknown[])
        .filter((x): x is { platform: unknown; query: unknown } => !!x && typeof x === "object")
        .map((x) => ({ platform: str(x.platform) || "facebook", query: str(x.query) }))
        .filter((x) => x.query.trim())
        .slice(0, 40)
    : [];
  return {
    audience: {
      summary: str(a.summary),
      segments: arr(a.segments),
      demographics: str(a.demographics),
      interests: arr(a.interests),
      painPoints: arr(a.painPoints),
      wateringHoles: arr(a.wateringHoles),
    },
    keywords: arr(o.keywords, 40),
    queries,
    generatedAt: str(o.generatedAt) || null,
  };
}

export function kitHasContent(k: DistributionKit): boolean {
  return !!k.audience.summary || k.keywords.length > 0 || k.queries.length > 0;
}

/** Build a platform group-search URL from a query (best-effort deep links). */
export function groupSearchUrl(platform: string, query: string): string {
  const q = encodeURIComponent(query.trim());
  switch (platform) {
    case "facebook":
      return `https://www.facebook.com/search/groups/?q=${q}`;
    case "linkedin":
      return `https://www.linkedin.com/search/results/groups/?keywords=${q}`;
    case "reddit":
      return `https://www.reddit.com/search/?q=${q}&type=sr`;
    case "telegram":
      // Telegram has no public web group search; route through a general search.
      return `https://www.google.com/search?q=${encodeURIComponent(`site:t.me ${query}`)}`;
    case "whatsapp":
      return `https://www.google.com/search?q=${encodeURIComponent(`whatsapp group ${query}`)}`;
    default:
      return `https://www.google.com/search?q=${q}`;
  }
}
