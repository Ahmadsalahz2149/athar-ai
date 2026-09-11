import { providerFetch } from "@/lib/ai/http";
import { PLATFORMS, type PlatformId } from "./registry";

/**
 * Access-token refresh (Phase 7.4).
 *
 * A post scheduled for next Tuesday runs long after the token that authorized
 * it was issued, so the publisher refreshes before it calls the platform rather
 * than discovering a 401 and burning the attempt.
 *
 * Meta is deliberately absent: it has no refresh_token grant. Page tokens
 * derived from a long-lived user token (see profile.ts) do not expire, so there
 * is nothing to refresh — a dead Meta connection means re-consent.
 */

const REFRESH_TIMEOUT_MS = 20_000;
/** Refresh this far ahead of expiry — a token that dies mid-request is a failed
 * post, and clock skew between us and the platform is real. */
export const REFRESH_SKEW_MS = 5 * 60 * 1000;

export type StoredToken = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | string | null;
};

export type RefreshedToken = { accessToken: string; refreshToken: string | null; expiresAt: Date | null };

/** True when the token is expired, or close enough that we should refresh now. */
export function needsRefresh(t: StoredToken, now: number = Date.now()): boolean {
  if (!t.expiresAt) return false; // no expiry recorded — nothing to act on
  const at = t.expiresAt instanceof Date ? t.expiresAt.getTime() : new Date(t.expiresAt).getTime();
  if (Number.isNaN(at)) return false;
  return at - now <= REFRESH_SKEW_MS;
}

/** Platforms whose OAuth2 server implements the refresh_token grant. */
export function supportsRefresh(platform: PlatformId): boolean {
  return platform === "linkedin" || platform === "x";
}

export async function refreshToken(platform: PlatformId, refresh: string): Promise<RefreshedToken> {
  const c = PLATFORMS[platform];
  const clientId = process.env[c.clientIdEnv] ?? "";
  const clientSecret = process.env[c.clientSecretEnv] ?? "";
  const params = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: clientId });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (platform === "x" && clientSecret) {
    // X authenticates confidential clients with HTTP Basic, not a body secret.
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else if (clientSecret) {
    params.set("client_secret", clientSecret);
  }

  const res = await providerFetch(c.tokenUrl, { method: "POST", headers, body: params.toString() }, REFRESH_TIMEOUT_MS);
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`${platform} token refresh failed: ${data.error_description || data.error || res.status}`);
  }
  return {
    // X rotates refresh tokens: keeping the old one would break the *next*
    // refresh, so always prefer the one the response carries.
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refresh,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}
