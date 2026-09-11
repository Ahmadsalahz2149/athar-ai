import { providerFetch } from "@/lib/ai/http";
import { PLATFORMS, type PlatformId } from "./registry";

/**
 * Real publishing (Phase 7.4). One function per platform, all behind a single
 * `publishPost` entry point, so the job handler never branches on the platform.
 *
 * Deliberately free of `server-only` and of any DB import: everything here is a
 * pure request builder plus `fetch`, which keeps the payload/limit/escaping
 * rules unit-testable without a database or a Next request scope. Tokens are
 * passed in by the caller — this module never reads a connection itself.
 *
 * Graph API version is pinned (not "latest"): Meta breaks calls on unversioned
 * paths, and a silent bump would change behaviour under us.
 */

const GRAPH = "https://graph.facebook.com/v21.0";
const LINKEDIN_VERSION = "202411";
const PUBLISH_TIMEOUT_MS = 30_000;

/** A publish attempt that failed, classified so the job layer knows what to do:
 * retry with backoff, or stop and surface the reason to the user. */
export class PublishError extends Error {
  readonly retryable: boolean;
  /** The platform rejected our credentials — the connection needs re-auth. */
  readonly authInvalid: boolean;
  readonly status?: number;
  constructor(message: string, opts: { retryable: boolean; authInvalid?: boolean; status?: number }) {
    super(message);
    this.name = "PublishError";
    this.retryable = opts.retryable;
    this.authInvalid = opts.authInvalid ?? false;
    this.status = opts.status;
  }
}

export type PublishInput = {
  /** The composed post text (hook + body). */
  text: string;
  /** Publicly reachable image URL. Required by Instagram, ignored elsewhere. */
  imageUrl?: string | null;
};

export type PublishConnection = {
  accessToken: string;
  /** Person URN (LinkedIn), Page id (Facebook), IG user id (Instagram). */
  externalAccountId?: string | null;
};

export type PublishResult = {
  externalPostId: string;
  /** Permalink to the live post, when the platform gives us one. */
  externalUrl: string | null;
};

// --- Text rules -------------------------------------------------------------

/** Hard per-platform text limits, as documented by each platform. */
export const TEXT_LIMITS: Record<PlatformId, number> = {
  x: 280,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
};

/** The post text as the user sees it everywhere else in the app (Studio copy,
 * export, preview) — keep this the single definition so what we publish is
 * byte-for-byte what was reviewed and approved. */
export function composePost(hook: string, body: string): string {
  return `${hook}\n\n${body}`.trim();
}

/** X counts a t.co-shortened URL as 23 characters regardless of its real
 * length, and counts code points (not UTF-16 units) — Arabic letters are one
 * each. Counting `text.length` rejected valid posts and accepted invalid ones. */
export function tweetLength(text: string): number {
  const URL_WEIGHT = 23;
  let n = 0;
  for (const token of text.split(/(\s+)/)) {
    if (/^https?:\/\/\S+$/i.test(token)) n += URL_WEIGHT;
    else n += [...token].length;
  }
  return n;
}

/** Code-point length — the unit every non-X platform documents its limit in. */
export function textLength(platform: PlatformId, text: string): number {
  return platform === "x" ? tweetLength(text) : [...text].length;
}

/** null when the text is publishable, otherwise the reason it is not. These are
 * user errors, never retried: a 301-character tweet is 301 characters forever. */
export function validateText(platform: PlatformId, text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "empty_text";
  const len = textLength(platform, trimmed);
  if (len > TEXT_LIMITS[platform]) return `too_long:${len}/${TEXT_LIMITS[platform]}`;
  return null;
}

/** LinkedIn's Posts API treats `commentary` as "little text": these characters
 * are markup and must be backslash-escaped or the call fails with a 422. */
export function escapeLinkedInText(text: string): string {
  return text.replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => `\\${c}`);
}

// --- HTTP error classification ---------------------------------------------

/** How to treat an HTTP failure. 401/403 means the token is dead — retrying it
 * three times just burns attempts and delays telling the user to reconnect. */
export function classifyStatus(status: number): { retryable: boolean; authInvalid: boolean } {
  if (status === 401 || status === 403) return { retryable: false, authInvalid: true };
  if (status === 429) return { retryable: true, authInvalid: false };
  if (status >= 500) return { retryable: true, authInvalid: false };
  return { retryable: false, authInvalid: false };
}

async function readError(res: Response): Promise<string> {
  const raw = (await res.text().catch(() => "")).slice(0, 600);
  try {
    const j = JSON.parse(raw) as { error?: { message?: string } | string; message?: string; detail?: string; title?: string };
    const e = j.error;
    const msg = (typeof e === "string" ? e : e?.message) || j.message || j.detail || j.title;
    if (msg) return msg;
  } catch {
    /* not JSON — fall through to the raw body */
  }
  return raw || `HTTP ${res.status}`;
}

/** Every platform call goes through here so timeouts, network faults and HTTP
 * errors are classified once instead of four slightly different ways. */
async function call(platform: PlatformId, url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await providerFetch(url, init, PUBLISH_TIMEOUT_MS);
  } catch (e) {
    // Timeout or transport fault: the post may or may not have landed, but the
    // platform is the only one who knows — retrying is the best we can do.
    throw new PublishError(`${platform}: ${e instanceof Error ? e.message : String(e)}`, { retryable: true });
  }
  if (!res.ok) {
    const { retryable, authInvalid } = classifyStatus(res.status);
    throw new PublishError(`${platform}: ${await readError(res)}`, { retryable, authInvalid, status: res.status });
  }
  return res;
}

// --- Platform publishers ----------------------------------------------------

async function publishLinkedIn(conn: PublishConnection, input: PublishInput): Promise<PublishResult> {
  const author = conn.externalAccountId;
  if (!author) throw new PublishError("linkedin: connection has no member urn — reconnect the account", { retryable: false, authInvalid: true });
  const res = await call("linkedin", "https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      commentary: escapeLinkedInText(input.text),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  // The created post's URN comes back in a header, not the (empty) body.
  const urn = res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id");
  if (!urn) throw new PublishError("linkedin: post accepted but no id returned", { retryable: false });
  return { externalPostId: urn, externalUrl: `https://www.linkedin.com/feed/update/${urn}/` };
}

async function publishX(conn: PublishConnection, input: PublishInput): Promise<PublishResult> {
  const res = await call("x", "https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: input.text }),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { id?: string } };
  const id = data.data?.id;
  if (!id) throw new PublishError("x: post accepted but no id returned", { retryable: false });
  return { externalPostId: id, externalUrl: `https://x.com/i/web/status/${id}` };
}

async function publishFacebook(conn: PublishConnection, input: PublishInput): Promise<PublishResult> {
  const pageId = conn.externalAccountId;
  if (!pageId) throw new PublishError("facebook: connection has no page id — reconnect the account", { retryable: false, authInvalid: true });
  const body = new URLSearchParams({ message: input.text, access_token: conn.accessToken });
  const res = await call("facebook", `${GRAPH}/${encodeURIComponent(pageId)}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  if (!data.id) throw new PublishError("facebook: post accepted but no id returned", { retryable: false });
  return { externalPostId: data.id, externalUrl: `https://www.facebook.com/${data.id}` };
}

async function publishInstagram(conn: PublishConnection, input: PublishInput): Promise<PublishResult> {
  const igUserId = conn.externalAccountId;
  if (!igUserId) throw new PublishError("instagram: connection has no business account id — reconnect the account", { retryable: false, authInvalid: true });
  // Instagram has no text-only post type. Failing here (rather than at Meta,
  // with an opaque error) tells the user exactly what to do: attach an image.
  if (!input.imageUrl) throw new PublishError("instagram: a post needs an image", { retryable: false });

  const created = await call("instagram", `${GRAPH}/${encodeURIComponent(igUserId)}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ image_url: input.imageUrl, caption: input.text, access_token: conn.accessToken }).toString(),
  });
  const container = (await created.json().catch(() => ({}))) as { id?: string };
  if (!container.id) throw new PublishError("instagram: media container was not created", { retryable: true });

  const published = await call("instagram", `${GRAPH}/${encodeURIComponent(igUserId)}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: container.id, access_token: conn.accessToken }).toString(),
  });
  const data = (await published.json().catch(() => ({}))) as { id?: string };
  if (!data.id) throw new PublishError("instagram: publish returned no media id", { retryable: false });

  // Best-effort permalink: the post is already live, so a failure here must not
  // turn a successful publish into a retry.
  let url: string | null = null;
  try {
    // The token goes in a header, not the query string: a URL is written to
    // access logs, proxy logs and error reports, and a Page token pasted there
    // is a credential sitting in plain text in places nobody audits.
    const meta = await providerFetch(
      `${GRAPH}/${encodeURIComponent(data.id)}?fields=permalink`,
      { headers: { Authorization: `Bearer ${conn.accessToken}` } },
      PUBLISH_TIMEOUT_MS,
    );
    if (meta.ok) url = ((await meta.json()) as { permalink?: string }).permalink ?? null;
  } catch {
    /* permalink is cosmetic */
  }
  return { externalPostId: data.id, externalUrl: url };
}

const PUBLISHERS: Record<PlatformId, (c: PublishConnection, i: PublishInput) => Promise<PublishResult>> = {
  linkedin: publishLinkedIn,
  x: publishX,
  facebook: publishFacebook,
  instagram: publishInstagram,
};

/** Publish one post. Throws PublishError; the caller decides retry vs. surface. */
export async function publishPost(platform: PlatformId, conn: PublishConnection, input: PublishInput): Promise<PublishResult> {
  if (!PLATFORMS[platform]) throw new PublishError(`unknown platform "${platform}"`, { retryable: false });
  const invalid = validateText(platform, input.text);
  if (invalid) throw new PublishError(`${platform}: ${invalid}`, { retryable: false });
  return PUBLISHERS[platform]({ ...conn, accessToken: conn.accessToken }, { ...input, text: input.text.trim() });
}
