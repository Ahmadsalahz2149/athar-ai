import crypto from "node:crypto";
import { PLATFORMS, type PlatformId } from "./registry";

/**
 * Generic OAuth2 authorization-code helpers (Phase 7.3). The authorize/exchange
 * shapes are uniform across LinkedIn / Meta / X; per-platform profile fetch and
 * posting are wired in publish.ts as each platform's keys become testable.
 */

export const b64url = (buf: Buffer) => buf.toString("base64url");

export function randomState(): string {
  return b64url(crypto.randomBytes(16));
}

/** PKCE pair for X's OAuth2 flow. */
export function pkce(): { verifier: string; challenge: string } {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/** The public base URL used to build OAuth redirect URIs. Behind a tunnel/proxy
 * the request's own origin may be the internal localhost, which breaks the
 * redirect_uri match. OAUTH_BASE_URL pins the externally-reachable https URL. */
export function publicOrigin(reqOrigin: string): string {
  return process.env.OAUTH_BASE_URL?.replace(/\/$/, "") || reqOrigin;
}

export function redirectUri(origin: string, platform: PlatformId): string {
  return `${publicOrigin(origin)}/api/social/${platform}/callback`;
}

export function buildAuthorizeUrl(platform: PlatformId, origin: string, state: string, codeChallenge?: string): string {
  const c = PLATFORMS[platform];
  const clientId = process.env[c.clientIdEnv] ?? "";
  const u = new URL(c.authorizeUrl);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri(origin, platform));
  u.searchParams.set("scope", c.scopes);
  u.searchParams.set("state", state);
  if (c.usesPkce && codeChallenge) {
    u.searchParams.set("code_challenge", codeChallenge);
    u.searchParams.set("code_challenge_method", "S256");
  }
  return u.toString();
}

export type TokenResult = { accessToken: string; refreshToken: string | null; expiresAt: Date | null; scopes: string | null };

/** Exchange an authorization code for tokens (uniform OAuth2 token request). */
export async function exchangeCode(platform: PlatformId, origin: string, code: string, codeVerifier?: string): Promise<TokenResult> {
  const c = PLATFORMS[platform];
  const clientId = process.env[c.clientIdEnv] ?? "";
  const clientSecret = process.env[c.clientSecretEnv] ?? "";
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(origin, platform),
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (c.usesPkce && codeVerifier) params.set("code_verifier", codeVerifier);

  const res = await fetch(c.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: params.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`token exchange failed: ${data.error_description || data.error || res.status}`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    scopes: data.scope ?? c.scopes,
  };
}
