import { providerFetch } from "@/lib/ai/http";
import type { PlatformId } from "./registry";

/**
 * Who did we just connect? (Phase 7.4)
 *
 * Publishing needs an account identifier the OAuth token exchange does not give
 * us: LinkedIn wants an author URN, Facebook a Page id, Instagram a business
 * account id. We resolve it once at connect time and store it on the
 * connection, so the publisher never makes an extra round-trip per post — and
 * so a misconfigured account (no Page, no linked IG account) is caught while
 * the user is still on the settings screen instead of at publish time.
 *
 * For Meta the *token* also changes here: posting to a Page requires that
 * Page's own token, not the user token the OAuth flow returned.
 */

const GRAPH = "https://graph.facebook.com/v21.0";
const PROFILE_TIMEOUT_MS = 20_000;

export type Account = {
  externalAccountId: string;
  accountName: string | null;
  /** Set when the platform requires a different token than the one we exchanged. */
  accessToken?: string;
  expiresAt?: Date | null;
};

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await providerFetch(url, init, PROFILE_TIMEOUT_MS);
  if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
  return (await res.json()) as T;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

type Page = { id: string; name?: string; access_token?: string; instagram_business_account?: { id: string; username?: string } };

/** Long-lived user token (~60 days). Meta's authorization-code token lives ~1h;
 * the Page tokens derived from a long-lived user token do not expire at all, so
 * this one exchange is what keeps a connection working past the first hour. */
async function metaLongLived(shortToken: string): Promise<string> {
  const clientId = process.env.META_CLIENT_ID ?? "";
  const clientSecret = process.env.META_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) return shortToken;
  try {
    // POSTed as a form body, not a query string. A URL is recorded by access
    // logs, proxies and error reporters — and this particular URL would carry
    // the app's client_secret, which must never be written anywhere like that.
    // (This is also exactly how oauth.ts already talks to the same endpoint.)
    const body = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: clientId, client_secret: clientSecret, fb_exchange_token: shortToken });
    const data = await getJson<{ access_token?: string }>(`${GRAPH}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    });
    return data.access_token || shortToken;
  } catch {
    // Not fatal: the short-lived token still works for the next hour, and the
    // user can reconnect. Failing the whole connect here would be worse.
    return shortToken;
  }
}

async function metaPages(userToken: string): Promise<Page[]> {
  // Token in the Authorization header rather than the query string, for the
  // same reason: a URL is not a safe place to put a credential.
  const q = new URLSearchParams({ fields: "id,name,access_token,instagram_business_account{id,username}" });
  const data = await getJson<{ data?: Page[] }>(`${GRAPH}/me/accounts?${q}`, { headers: bearer(userToken) });
  return data.data ?? [];
}

export async function fetchAccount(platform: PlatformId, accessToken: string): Promise<Account> {
  if (platform === "linkedin") {
    const me = await getJson<{ sub?: string; name?: string }>("https://api.linkedin.com/v2/userinfo", { headers: bearer(accessToken) });
    if (!me.sub) throw new Error("linkedin userinfo returned no subject");
    return { externalAccountId: `urn:li:person:${me.sub}`, accountName: me.name ?? null };
  }

  if (platform === "x") {
    const me = await getJson<{ data?: { id?: string; username?: string; name?: string } }>("https://api.twitter.com/2/users/me", { headers: bearer(accessToken) });
    const id = me.data?.id;
    if (!id) throw new Error("x users/me returned no id");
    return { externalAccountId: id, accountName: me.data?.username ? `@${me.data.username}` : (me.data?.name ?? null) };
  }

  const userToken = await metaLongLived(accessToken);
  const pages = await metaPages(userToken);

  if (platform === "facebook") {
    const page = pages.find((p) => p.access_token);
    if (!page) throw new Error("no facebook page found on this account");
    return { externalAccountId: page.id, accountName: page.name ?? null, accessToken: page.access_token, expiresAt: null };
  }

  // instagram
  const page = pages.find((p) => p.instagram_business_account?.id && p.access_token);
  if (!page) throw new Error("no instagram business account linked to a facebook page");
  return {
    externalAccountId: page.instagram_business_account!.id,
    accountName: page.instagram_business_account!.username ? `@${page.instagram_business_account!.username}` : (page.name ?? null),
    accessToken: page.access_token,
    expiresAt: null,
  };
}
