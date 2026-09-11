import { describe, it, expect, vi, afterEach } from "vitest";
import {
  PublishError, TEXT_LIMITS, classifyStatus, composePost, escapeLinkedInText,
  publishPost, textLength, tweetLength, validateText,
} from "@/lib/social/publish";
import { toPlatformId } from "@/lib/social/registry";
import { needsRefresh, supportsRefresh, REFRESH_SKEW_MS } from "@/lib/social/tokens";
import { DRAFT_STATUSES, USER_SETTABLE_STATUSES, isUserSettableStatus } from "@/lib/drafts/states";

// --- Platform resolution ----------------------------------------------------
// Drafts store the Studio's display label, the publisher is keyed by id. Getting
// this wrong means "no connection found" for every real draft.
describe("toPlatformId", () => {
  it("maps the Studio's display labels", () => {
    expect(toPlatformId("LinkedIn")).toBe("linkedin");
    expect(toPlatformId("X / Twitter")).toBe("x");
    expect(toPlatformId("Instagram")).toBe("instagram");
    expect(toPlatformId("Facebook")).toBe("facebook");
  });

  it("accepts ids unchanged and rejects the unknown", () => {
    expect(toPlatformId("x")).toBe("x");
    expect(toPlatformId("linkedin")).toBe("linkedin");
    expect(toPlatformId("TikTok")).toBeNull();
    expect(toPlatformId("")).toBeNull();
    expect(toPlatformId(null)).toBeNull();
  });
});

// --- Text rules -------------------------------------------------------------
describe("post text", () => {
  it("composes hook and body the way the rest of the app does", () => {
    expect(composePost("Hook", "Body")).toBe("Hook\n\nBody");
  });

  it("counts Arabic by code point, not UTF-16 unit", () => {
    const arabic = "مرحبا"; // 5 letters
    expect(textLength("x", arabic)).toBe(5);
    expect(textLength("linkedin", arabic)).toBe(5);
  });

  it("counts a URL as X's fixed 23 characters", () => {
    const long = `https://example.com/${"a".repeat(200)}`;
    expect(tweetLength(long)).toBe(23);
    expect(tweetLength(`hi ${long}`)).toBe(3 + 23);
  });

  it("rejects text over the platform limit and accepts it at the limit", () => {
    const at = "ا".repeat(TEXT_LIMITS.x);
    expect(validateText("x", at)).toBeNull();
    expect(validateText("x", at + "ا")).toMatch(/^too_long:281\/280$/);
    expect(validateText("linkedin", "ا".repeat(TEXT_LIMITS.linkedin + 1))).toMatch(/^too_long:/);
  });

  it("rejects empty text", () => {
    expect(validateText("x", "   \n ")).toBe("empty_text");
  });

  it("escapes the characters LinkedIn treats as markup", () => {
    expect(escapeLinkedInText("a (b) [c] {d} @e #f _g *h ~i <j> |k")).toBe(
      "a \\(b\\) \\[c\\] \\{d\\} \\@e \\#f \\_g \\*h \\~i \\<j\\> \\|k",
    );
    // The backslash itself must be escaped first, or the escape is ambiguous.
    expect(escapeLinkedInText("a\\b")).toBe("a\\\\b");
    expect(escapeLinkedInText("مرحبا بالعالم")).toBe("مرحبا بالعالم");
  });
});

// --- Error classification ---------------------------------------------------
describe("classifyStatus", () => {
  it("treats a dead token as permanent, and says the auth is invalid", () => {
    for (const s of [401, 403]) {
      expect(classifyStatus(s)).toEqual({ retryable: false, authInvalid: true });
    }
  });

  it("retries rate limits and server faults", () => {
    expect(classifyStatus(429).retryable).toBe(true);
    expect(classifyStatus(500).retryable).toBe(true);
    expect(classifyStatus(503).retryable).toBe(true);
  });

  it("does not retry a request the platform called invalid", () => {
    expect(classifyStatus(400)).toEqual({ retryable: false, authInvalid: false });
    expect(classifyStatus(422).retryable).toBe(false);
  });
});

// --- Token refresh ----------------------------------------------------------
describe("token refresh policy", () => {
  const now = Date.now();

  it("refreshes a token that is expired or about to be", () => {
    expect(needsRefresh({ accessToken: "t", expiresAt: new Date(now - 1000) }, now)).toBe(true);
    expect(needsRefresh({ accessToken: "t", expiresAt: new Date(now + REFRESH_SKEW_MS - 1000) }, now)).toBe(true);
  });

  it("leaves a healthy token alone", () => {
    expect(needsRefresh({ accessToken: "t", expiresAt: new Date(now + 60 * 60 * 1000) }, now)).toBe(false);
  });

  it("does nothing when no expiry was recorded", () => {
    expect(needsRefresh({ accessToken: "t", expiresAt: null }, now)).toBe(false);
    expect(needsRefresh({ accessToken: "t" }, now)).toBe(false);
  });

  it("only claims refresh support where the grant actually exists", () => {
    expect(supportsRefresh("linkedin")).toBe(true);
    expect(supportsRefresh("x")).toBe(true);
    // Meta has no refresh_token grant — pretending otherwise would burn attempts.
    expect(supportsRefresh("facebook")).toBe(false);
    expect(supportsRefresh("instagram")).toBe(false);
  });
});

// --- Publishing over a stubbed network -------------------------------------
type Call = { url: string; init: RequestInit };

function stubFetch(responses: Array<{ status?: number; body?: unknown; headers?: Record<string, string> }>) {
  const calls: Call[] = [];
  let i = 0;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const r = responses[Math.min(i++, responses.length - 1)];
    const status = r.status ?? 200;
    return new Response(JSON.stringify(r.body ?? {}), { status, headers: r.headers });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("publishPost", () => {
  it("posts to LinkedIn as the stored member urn and returns the post's permalink", async () => {
    const urn = "urn:li:share:7123";
    const calls = stubFetch([{ status: 201, headers: { "x-restli-id": urn } }]);
    const out = await publishPost("linkedin", { accessToken: "tok", externalAccountId: "urn:li:person:abc" }, { text: "مرحبا (بالعالم)" });

    expect(out).toEqual({ externalPostId: urn, externalUrl: `https://www.linkedin.com/feed/update/${urn}/` });
    expect(calls[0].url).toBe("https://api.linkedin.com/rest/posts");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers["LinkedIn-Version"]).toBeTruthy();
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.author).toBe("urn:li:person:abc");
    expect(body.lifecycleState).toBe("PUBLISHED");
    expect(body.commentary).toBe("مرحبا \\(بالعالم\\)"); // escaped, not raw
  });

  it("refuses LinkedIn without a member urn instead of posting as nobody", async () => {
    stubFetch([{ status: 201 }]);
    await expect(publishPost("linkedin", { accessToken: "tok" }, { text: "hi" })).rejects.toMatchObject({
      name: "PublishError", retryable: false, authInvalid: true,
    });
  });

  it("posts a tweet and links to it", async () => {
    const calls = stubFetch([{ status: 201, body: { data: { id: "999" } } }]);
    const out = await publishPost("x", { accessToken: "tok" }, { text: "hello" });
    expect(out).toEqual({ externalPostId: "999", externalUrl: "https://x.com/i/web/status/999" });
    expect(calls[0].url).toBe("https://api.twitter.com/2/tweets");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ text: "hello" });
  });

  it("posts to a Facebook page with the page token", async () => {
    const calls = stubFetch([{ body: { id: "page_1" } }]);
    const out = await publishPost("facebook", { accessToken: "pagetok", externalAccountId: "42" }, { text: "hi" });
    expect(out.externalPostId).toBe("page_1");
    expect(calls[0].url).toContain("/42/feed");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("access_token")).toBe("pagetok");
    expect(body.get("message")).toBe("hi");
  });

  it("publishes to Instagram in two steps: container, then publish", async () => {
    const calls = stubFetch([
      { body: { id: "container_1" } },
      { body: { id: "media_1" } },
      { body: { permalink: "https://instagram.com/p/abc" } },
    ]);
    const out = await publishPost("instagram", { accessToken: "tok", externalAccountId: "ig1" }, { text: "hi", imageUrl: "https://cdn/x.png" });
    expect(out).toEqual({ externalPostId: "media_1", externalUrl: "https://instagram.com/p/abc" });
    expect(calls[0].url).toContain("/ig1/media");
    expect(calls[1].url).toContain("/ig1/media_publish");
    expect(new URLSearchParams(calls[1].init.body as string).get("creation_id")).toBe("container_1");
  });

  it("does not call Instagram at all for a text-only post", async () => {
    const calls = stubFetch([{ body: { id: "x" } }]);
    await expect(publishPost("instagram", { accessToken: "t", externalAccountId: "ig1" }, { text: "hi" }))
      .rejects.toMatchObject({ retryable: false });
    expect(calls).toHaveLength(0);
  });

  it("keeps a successful Instagram publish successful when the permalink lookup fails", async () => {
    stubFetch([
      { body: { id: "container_1" } },
      { body: { id: "media_1" } },
      { status: 500 }, // permalink fetch — cosmetic, must not fail the publish
    ]);
    const out = await publishPost("instagram", { accessToken: "tok", externalAccountId: "ig1" }, { text: "hi", imageUrl: "https://cdn/x.png" });
    expect(out).toEqual({ externalPostId: "media_1", externalUrl: null });
  });

  it("marks a revoked token as permanent + auth-invalid, and a 429 as retryable", async () => {
    stubFetch([{ status: 401, body: { error: { message: "token revoked" } } }]);
    await expect(publishPost("x", { accessToken: "dead" }, { text: "hi" }))
      .rejects.toMatchObject({ retryable: false, authInvalid: true, status: 401 });

    vi.unstubAllGlobals();
    stubFetch([{ status: 429, body: { title: "Too Many Requests" } }]);
    await expect(publishPost("x", { accessToken: "tok" }, { text: "hi" }))
      .rejects.toMatchObject({ retryable: true, authInvalid: false, status: 429 });
  });

  it("treats a network fault as retryable — the post may still have landed", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("ECONNRESET"); });
    await expect(publishPost("x", { accessToken: "tok" }, { text: "hi" }))
      .rejects.toMatchObject({ name: "PublishError", retryable: true });
  });

  it("rejects over-long text before it ever reaches the network", async () => {
    const calls = stubFetch([{ status: 201, body: { data: { id: "1" } } }]);
    await expect(publishPost("x", { accessToken: "tok" }, { text: "ا".repeat(281) }))
      .rejects.toBeInstanceOf(PublishError);
    expect(calls).toHaveLength(0);
  });
});

// --- Who may write which state ---------------------------------------------
// `published` is a claim that a post is live on a platform, rendered as a link.
// A server action is callable directly, so the union in its signature is not
// the guard — this list is.
describe("draft state permissions", () => {
  it("lets a user move a draft through review", () => {
    for (const s of ["draft", "pending", "approved", "needs_edit", "scheduled", "rejected"]) {
      expect(isUserSettableStatus(s)).toBe(true);
    }
  });

  it("reserves every publisher-owned state", () => {
    for (const s of ["publishing", "published", "publish_failed"]) {
      expect(isUserSettableStatus(s)).toBe(false);
    }
    expect(isUserSettableStatus("anything-else")).toBe(false);
  });

  it("keeps the settable list a subset of the real lifecycle", () => {
    for (const s of USER_SETTABLE_STATUSES) expect(DRAFT_STATUSES).toContain(s);
  });
});
