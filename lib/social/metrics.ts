import { providerFetch } from "@/lib/ai/http";
import type { PlatformId } from "./registry";

/**
 * Reading a published post's real performance back from the platform (Phase 8).
 *
 * The mirror of publish.ts, and deliberately built the same way: one function
 * per platform behind a single entry point, no DB import, no `server-only`, so
 * every mapping rule is unit-testable against a plain object.
 *
 * The hard part is not fetching — it is being honest about what came back. No
 * two platforms expose the same metrics, and several expose none at all unless
 * the app has been granted a permission it may not have. So every field is
 * `number | null`, and "the platform will not tell us" is a distinct outcome
 * from "the platform said zero". Showing an unavailable number as 0 would be a
 * lie the customer makes decisions on.
 */

const GRAPH = "https://graph.facebook.com/v21.0";
const LINKEDIN_VERSION = "202411";
const METRICS_TIMEOUT_MS = 20_000;

/** What every platform is mapped onto. A null means "not provided", never zero. */
export type PostMetrics = {
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  clicks: number | null;
};

export const EMPTY_METRICS: PostMetrics = {
  impressions: null,
  likes: null,
  comments: null,
  shares: null,
  clicks: null,
};

/**
 * A collection attempt that failed, classified so the job layer knows what to
 * do — and so the UI can tell a customer WHY a platform shows nothing.
 *
 * `permission` is the third state that matters and would otherwise hide inside
 * "failed": the post exists and the call was well-formed, but this app has not
 * been granted the scope that returns analytics. Retrying that forever is
 * pointless; it needs a platform approval, not a backoff.
 */
export class MetricsError extends Error {
  readonly retryable: boolean;
  readonly authInvalid: boolean;
  readonly permission: boolean;
  readonly status?: number;
  constructor(message: string, opts: { retryable: boolean; authInvalid?: boolean; permission?: boolean; status?: number }) {
    super(message);
    this.name = "MetricsError";
    this.retryable = opts.retryable;
    this.authInvalid = opts.authInvalid ?? false;
    this.permission = opts.permission ?? false;
    this.status = opts.status;
  }
}

export type MetricsConnection = {
  accessToken: string;
  /** Page id for Facebook, IG user id for Instagram; unused elsewhere. */
  externalAccountId?: string | null;
};

/** Coerce a platform's number into a metric, keeping "absent" distinct from 0. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** Sum the parts a platform reports separately, staying null when none exist.
 * Reposts and quotes are both "shares" to a person reading a dashboard. */
export function sumParts(...parts: (number | null)[]): number | null {
  const present = parts.filter((p): p is number => p !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

/** True when a post has nothing to tell us yet — every field unavailable. */
export function isEmpty(m: PostMetrics): boolean {
  return Object.values(m).every((v) => v === null);
}

/**
 * How to treat an HTTP failure.
 *
 * 403 is the interesting one: for these endpoints it almost always means the
 * token is valid but the scope is missing, which is a permission problem to
 * surface rather than an auth failure to re-prompt for. A 401 really is a dead
 * token.
 */
export function classifyMetricsStatus(status: number): { retryable: boolean; authInvalid: boolean; permission: boolean } {
  if (status === 401) return { retryable: false, authInvalid: true, permission: false };
  if (status === 403) return { retryable: false, authInvalid: false, permission: true };
  if (status === 404 || status === 410) return { retryable: false, authInvalid: false, permission: false }; // deleted on the platform
  if (status === 429 || status >= 500) return { retryable: true, authInvalid: false, permission: false };
  return { retryable: false, authInvalid: false, permission: false };
}

async function readError(res: Response): Promise<string> {
  const raw = (await res.text().catch(() => "")).slice(0, 400);
  try {
    const j = JSON.parse(raw) as { error?: { message?: string } | string; message?: string; detail?: string; title?: string };
    const e = j.error;
    const msg = (typeof e === "string" ? e : e?.message) || j.message || j.detail || j.title;
    if (msg) return msg;
  } catch {
    /* not JSON */
  }
  return raw || `HTTP ${res.status}`;
}

async function call(platform: PlatformId, url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await providerFetch(url, init, METRICS_TIMEOUT_MS);
  } catch (e) {
    throw new MetricsError(`${platform}: ${e instanceof Error ? e.message : String(e)}`, { retryable: true });
  }
  if (!res.ok) {
    const c = classifyMetricsStatus(res.status);
    throw new MetricsError(`${platform}: ${await readError(res)}`, { ...c, status: res.status });
  }
  return res;
}

/** A call whose failure must not sink the whole collection — an insights
 * endpoint we may not be permitted to read, alongside counts we can. */
async function optional<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// --- X ----------------------------------------------------------------------

type XMetrics = {
  impression_count?: number;
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
  quote_count?: number;
};

export function mapX(pm: XMetrics | undefined): PostMetrics {
  if (!pm) return { ...EMPTY_METRICS };
  return {
    impressions: num(pm.impression_count),
    likes: num(pm.like_count),
    comments: num(pm.reply_count),
    // A repost and a quote are both a share to anyone reading a dashboard.
    shares: sumParts(num(pm.retweet_count), num(pm.quote_count)),
    clicks: null, // needs the elevated non-public metrics tier
  };
}

async function fetchX(conn: MetricsConnection, postId: string): Promise<PostMetrics> {
  const res = await call("x", `https://api.twitter.com/2/tweets/${encodeURIComponent(postId)}?tweet.fields=public_metrics`, {
    headers: bearer(conn.accessToken),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { public_metrics?: XMetrics } };
  return mapX(data.data?.public_metrics);
}

// --- LinkedIn ---------------------------------------------------------------

type LiSocial = {
  likesSummary?: { totalLikes?: number };
  commentsSummary?: { totalFirstLevelComments?: number; aggregatedTotalComments?: number };
};

export function mapLinkedIn(s: LiSocial | undefined): PostMetrics {
  if (!s) return { ...EMPTY_METRICS };
  return {
    impressions: null, // member-post impressions need an analytics product we do not hold
    likes: num(s.likesSummary?.totalLikes),
    comments: num(s.commentsSummary?.totalFirstLevelComments ?? s.commentsSummary?.aggregatedTotalComments),
    shares: null,
    clicks: null,
  };
}

async function fetchLinkedIn(conn: MetricsConnection, postUrn: string): Promise<PostMetrics> {
  // socialActions carries the engagement counts on a post we authored. Where the
  // app lacks r_member_social this returns 403, which `permission` marks as a
  // platform approval to obtain — not a failure to retry.
  const res = await call("linkedin", `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(postUrn)}`, {
    headers: { ...bearer(conn.accessToken), "LinkedIn-Version": LINKEDIN_VERSION, "X-Restli-Protocol-Version": "2.0.0" },
  });
  return mapLinkedIn((await res.json().catch(() => ({}))) as LiSocial);
}

// --- Facebook ---------------------------------------------------------------

type FbCounts = {
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
};
type FbInsights = { data?: { name?: string; values?: { value?: unknown }[] }[] };

/** Graph insights come back as a list of named series; take each one's first value. */
export function insightValue(insights: FbInsights | null, name: string): number | null {
  const row = insights?.data?.find((d) => d.name === name);
  return num(row?.values?.[0]?.value);
}

export function mapFacebook(counts: FbCounts | undefined, insights: FbInsights | null): PostMetrics {
  return {
    impressions: insightValue(insights, "post_impressions"),
    likes: num(counts?.likes?.summary?.total_count),
    comments: num(counts?.comments?.summary?.total_count),
    shares: num(counts?.shares?.count),
    clicks: insightValue(insights, "post_clicks"),
  };
}

async function fetchFacebook(conn: MetricsConnection, postId: string): Promise<PostMetrics> {
  const id = encodeURIComponent(postId);
  const counts = await call("facebook", `${GRAPH}/${id}?fields=likes.summary(true),comments.summary(true),shares`, {
    headers: bearer(conn.accessToken),
  }).then((r) => r.json().catch(() => ({})) as Promise<FbCounts>);

  // Insights need pages_read_engagement. Counts are still worth keeping without
  // it, so a refusal here degrades the row rather than losing it.
  const insights = await optional(() =>
    call("facebook", `${GRAPH}/${id}/insights?metric=post_impressions,post_clicks`, { headers: bearer(conn.accessToken) })
      .then((r) => r.json().catch(() => ({})) as Promise<FbInsights>),
  );

  return mapFacebook(counts, insights);
}

// --- Instagram --------------------------------------------------------------

type IgCounts = { like_count?: number; comments_count?: number };

export function mapInstagram(counts: IgCounts | undefined, insights: FbInsights | null): PostMetrics {
  return {
    impressions: insightValue(insights, "impressions") ?? insightValue(insights, "reach"),
    likes: num(counts?.like_count),
    comments: num(counts?.comments_count),
    shares: insightValue(insights, "shares"),
    clicks: null,
  };
}

async function fetchInstagram(conn: MetricsConnection, mediaId: string): Promise<PostMetrics> {
  const id = encodeURIComponent(mediaId);
  const counts = await call("instagram", `${GRAPH}/${id}?fields=like_count,comments_count`, {
    headers: bearer(conn.accessToken),
  }).then((r) => r.json().catch(() => ({})) as Promise<IgCounts>);

  const insights = await optional(() =>
    call("instagram", `${GRAPH}/${id}/insights?metric=impressions,reach,shares`, { headers: bearer(conn.accessToken) })
      .then((r) => r.json().catch(() => ({})) as Promise<FbInsights>),
  );

  return mapInstagram(counts, insights);
}

const FETCHERS: Record<PlatformId, (c: MetricsConnection, id: string) => Promise<PostMetrics>> = {
  x: fetchX,
  linkedin: fetchLinkedIn,
  facebook: fetchFacebook,
  instagram: fetchInstagram,
};

/** Read one published post's current numbers. Throws MetricsError; the caller
 * decides between retrying, surfacing a permission gap, and giving up. */
export async function fetchPostMetrics(
  platform: PlatformId,
  conn: MetricsConnection,
  externalPostId: string,
): Promise<PostMetrics> {
  if (!externalPostId) throw new MetricsError(`${platform}: no external post id`, { retryable: false });
  return FETCHERS[platform](conn, externalPostId);
}

/**
 * A single number to rank posts by, from whatever the platform gave us.
 *
 * Engagement is weighted, not summed: a comment costs a reader far more effort
 * than a like, and a share is a public endorsement — so ranking by a raw total
 * would put a post with 200 passive likes above one that started fifty
 * conversations. Impressions are deliberately excluded: they measure how far a
 * platform chose to push a post, not whether it was any good.
 *
 * Returns null when nothing is known, so an unmeasured post is never ranked
 * against a measured one.
 */
export function engagementScore(m: PostMetrics): number | null {
  const parts = [
    m.likes === null ? null : m.likes * 1,
    m.comments === null ? null : m.comments * 4,
    m.shares === null ? null : m.shares * 6,
    m.clicks === null ? null : m.clicks * 2,
  ];
  return sumParts(...parts);
}
