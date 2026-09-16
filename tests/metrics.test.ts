import { describe, it, expect, vi, afterEach } from "vitest";
import {
  EMPTY_METRICS, MetricsError, classifyMetricsStatus, engagementScore, fetchPostMetrics,
  insightValue, isEmpty, mapFacebook, mapInstagram, mapLinkedIn, mapX, num, sumParts,
} from "@/lib/social/metrics";

/**
 * The whole point of this layer is being honest about what came back. No two
 * platforms expose the same metrics and several expose none without a scope we
 * may not hold — so "unavailable" has to stay distinct from "zero" at every
 * step. A dashboard that renders an unknown as 0 is a lie the customer makes
 * decisions on.
 */
describe("num", () => {
  it("keeps absent distinct from zero", () => {
    expect(num(undefined)).toBeNull();
    expect(num(null)).toBeNull();
    expect(num(0)).toBe(0); // a real zero survives
  });

  it("accepts the strings platforms send and rejects nonsense", () => {
    expect(num("42")).toBe(42);
    expect(num(12.6)).toBe(13);
    expect(num("abc")).toBeNull();
    expect(num(-5)).toBeNull(); // no metric is negative; that is bad data
  });
});

describe("sumParts", () => {
  it("adds what exists and stays null when nothing does", () => {
    expect(sumParts(1, 2, null)).toBe(3);
    expect(sumParts(null, null)).toBeNull();
    expect(sumParts(0, null)).toBe(0);
  });
});

describe("platform mapping", () => {
  it("maps X, counting a repost and a quote both as shares", () => {
    expect(mapX({ impression_count: 900, like_count: 30, reply_count: 4, retweet_count: 6, quote_count: 2 })).toEqual({
      impressions: 900, likes: 30, comments: 4, shares: 8, clicks: null,
    });
  });

  it("returns everything unavailable when a platform sends nothing", () => {
    expect(mapX(undefined)).toEqual(EMPTY_METRICS);
    expect(mapLinkedIn(undefined)).toEqual(EMPTY_METRICS);
    expect(isEmpty(mapX(undefined))).toBe(true);
  });

  it("maps LinkedIn's social counts and claims no impressions it cannot see", () => {
    const m = mapLinkedIn({ likesSummary: { totalLikes: 12 }, commentsSummary: { totalFirstLevelComments: 3 } });
    expect(m.likes).toBe(12);
    expect(m.comments).toBe(3);
    // Member-post impressions need an analytics product the app does not hold.
    expect(m.impressions).toBeNull();
  });

  it("falls back to LinkedIn's aggregate comment count when the first-level one is absent", () => {
    expect(mapLinkedIn({ commentsSummary: { aggregatedTotalComments: 9 } }).comments).toBe(9);
  });

  it("reads a named series out of Graph insights", () => {
    const insights = { data: [{ name: "post_impressions", values: [{ value: 1500 }] }, { name: "post_clicks", values: [{ value: 40 }] }] };
    expect(insightValue(insights, "post_impressions")).toBe(1500);
    expect(insightValue(insights, "not_requested")).toBeNull();
    expect(insightValue(null, "post_impressions")).toBeNull();
  });

  it("keeps Facebook counts when insights are refused", () => {
    // The realistic degraded case: counts are readable, insights need a scope
    // the app was not granted. The row is still worth having.
    const m = mapFacebook({ likes: { summary: { total_count: 20 } }, comments: { summary: { total_count: 5 } }, shares: { count: 2 } }, null);
    expect(m).toEqual({ impressions: null, likes: 20, comments: 5, shares: 2, clicks: null });
  });

  it("maps Instagram, using reach when impressions are not returned", () => {
    const m = mapInstagram({ like_count: 80, comments_count: 7 }, { data: [{ name: "reach", values: [{ value: 640 }] }] });
    expect(m.impressions).toBe(640);
    expect(m.likes).toBe(80);
    expect(m.comments).toBe(7);
  });
});

describe("classifyMetricsStatus", () => {
  // 403 here is almost always a missing scope, not a dead token. Retrying it
  // for days will not make the permission appear, and re-prompting the user to
  // reconnect would not either.
  it("separates a missing permission from a dead token", () => {
    expect(classifyMetricsStatus(403)).toEqual({ retryable: false, authInvalid: false, permission: true });
    expect(classifyMetricsStatus(401)).toEqual({ retryable: false, authInvalid: true, permission: false });
  });

  it("gives up on a post that no longer exists", () => {
    expect(classifyMetricsStatus(404).retryable).toBe(false);
    expect(classifyMetricsStatus(410).retryable).toBe(false);
  });

  it("retries rate limits and server faults", () => {
    expect(classifyMetricsStatus(429).retryable).toBe(true);
    expect(classifyMetricsStatus(503).retryable).toBe(true);
  });
});

describe("engagementScore", () => {
  // Ranking by a raw total would put 200 passive likes above a post that
  // started fifty conversations. Effort is what the weights encode.
  it("weights a comment and a share above a like", () => {
    const likes = engagementScore({ ...EMPTY_METRICS, likes: 10 })!;
    const comments = engagementScore({ ...EMPTY_METRICS, comments: 10 })!;
    const shares = engagementScore({ ...EMPTY_METRICS, shares: 10 })!;
    expect(comments).toBeGreaterThan(likes);
    expect(shares).toBeGreaterThan(comments);
  });

  // Impressions measure how far a platform chose to push a post, not whether
  // it was any good — so they must not move the ranking.
  it("ignores impressions entirely", () => {
    expect(engagementScore({ ...EMPTY_METRICS, impressions: 1_000_000 })).toBeNull();
    const a = engagementScore({ ...EMPTY_METRICS, likes: 5, impressions: 10 });
    const b = engagementScore({ ...EMPTY_METRICS, likes: 5, impressions: 100_000 });
    expect(a).toBe(b);
  });

  it("returns null for a post nothing is known about, so it is never ranked", () => {
    expect(engagementScore(EMPTY_METRICS)).toBeNull();
    expect(engagementScore({ ...EMPTY_METRICS, likes: 0 })).toBe(0); // measured, and it flopped
  });
});

// --- Over a stubbed network -------------------------------------------------
type Call = { url: string; init: RequestInit };

function stubFetch(responses: Array<{ status?: number; body?: unknown }>) {
  const calls: Call[] = [];
  let i = 0;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchPostMetrics", () => {
  it("reads a tweet's public metrics", async () => {
    const calls = stubFetch([{ body: { data: { public_metrics: { like_count: 11, reply_count: 2, retweet_count: 1, quote_count: 0, impression_count: 500 } } } }]);
    const m = await fetchPostMetrics("x", { accessToken: "tok" }, "999");
    expect(m).toEqual({ impressions: 500, likes: 11, comments: 2, shares: 1, clicks: null });
    expect(calls[0].url).toContain("/2/tweets/999");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("never puts the token in a URL", async () => {
    const calls = stubFetch([{ body: { like_count: 1, comments_count: 0 } }, { body: {} }, { body: {} }]);
    await fetchPostMetrics("instagram", { accessToken: "SECRET", externalAccountId: "ig1" }, "media_1");
    for (const c of calls) expect(c.url).not.toContain("SECRET");
  });

  it("surfaces a missing scope as a permission problem, not a retry", async () => {
    stubFetch([{ status: 403, body: { error: { message: "insufficient permission" } } }]);
    await expect(fetchPostMetrics("linkedin", { accessToken: "tok" }, "urn:li:share:1")).rejects.toMatchObject({
      name: "MetricsError", permission: true, retryable: false, authInvalid: false,
    });
  });

  it("marks a revoked token for re-auth", async () => {
    stubFetch([{ status: 401, body: {} }]);
    await expect(fetchPostMetrics("x", { accessToken: "dead" }, "1")).rejects.toMatchObject({ authInvalid: true, retryable: false });
  });

  it("retries a rate limit and a network fault", async () => {
    stubFetch([{ status: 429, body: {} }]);
    await expect(fetchPostMetrics("x", { accessToken: "t" }, "1")).rejects.toMatchObject({ retryable: true });

    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", async () => { throw new Error("ECONNRESET"); });
    await expect(fetchPostMetrics("x", { accessToken: "t" }, "1")).rejects.toMatchObject({ name: "MetricsError", retryable: true });
  });

  // Facebook's counts and its insights are separate calls with separate
  // permissions; losing the second must not lose the first.
  it("keeps what Facebook will share when insights are refused", async () => {
    stubFetch([
      { body: { likes: { summary: { total_count: 9 } }, comments: { summary: { total_count: 1 } }, shares: { count: 3 } } },
      { status: 403, body: { error: { message: "no insights scope" } } },
    ]);
    const m = await fetchPostMetrics("facebook", { accessToken: "tok", externalAccountId: "42" }, "page_1");
    expect(m).toEqual({ impressions: null, likes: 9, comments: 1, shares: 3, clicks: null });
  });

  it("refuses to call anything without an external post id", async () => {
    const calls = stubFetch([{ body: {} }]);
    await expect(fetchPostMetrics("x", { accessToken: "t" }, "")).rejects.toBeInstanceOf(MetricsError);
    expect(calls).toHaveLength(0);
  });
});
