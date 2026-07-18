/**
 * Social platform registry (Phase 7.3). Declarative config for each platform's
 * OAuth2 authorization-code flow. Live posting is wired per-provider in
 * lib/social/publish.ts once real keys exist and can be tested. `isConfigured`
 * gates the UI so a platform only offers "Connect" when its keys are present.
 */
export type PlatformId = "linkedin" | "x" | "instagram" | "facebook";

export type PlatformConfig = {
  id: PlatformId;
  label: string;
  /** OAuth2 authorize endpoint. */
  authorizeUrl: string;
  /** OAuth2 token endpoint. */
  tokenUrl: string;
  /** Scopes requested for posting on the user's behalf. */
  scopes: string;
  /** Env var names for this platform's client credentials. */
  clientIdEnv: string;
  clientSecretEnv: string;
  /** X requires PKCE on its OAuth2 flow. */
  usesPkce?: boolean;
  notes?: string;
};

export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: "openid profile w_member_social",
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
  },
  x: {
    id: "x",
    label: "X / Twitter",
    authorizeUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: "tweet.read tweet.write users.read offline.access",
    clientIdEnv: "X_CLIENT_ID",
    clientSecretEnv: "X_CLIENT_SECRET",
    usesPkce: true,
    notes: "X API posting requires a paid tier.",
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: "pages_manage_posts pages_read_engagement",
    clientIdEnv: "META_CLIENT_ID",
    clientSecretEnv: "META_CLIENT_SECRET",
    notes: "Requires a Facebook Page + app review for pages_manage_posts.",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: "instagram_basic instagram_content_publish pages_show_list",
    clientIdEnv: "META_CLIENT_ID",
    clientSecretEnv: "META_CLIENT_SECRET",
    notes: "Requires an IG Business/Creator account linked to a FB Page + app review.",
  },
};

export const PLATFORM_IDS = Object.keys(PLATFORMS) as PlatformId[];

export function isPlatform(x: string): x is PlatformId {
  return x in PLATFORMS;
}

/** True when this platform's client credentials are present in the environment. */
export function isConfigured(id: PlatformId): boolean {
  const c = PLATFORMS[id];
  return Boolean(process.env[c.clientIdEnv] && process.env[c.clientSecretEnv]);
}

/** Which platforms currently have credentials — for the settings UI. */
export function configuredPlatforms(): Record<PlatformId, boolean> {
  return PLATFORM_IDS.reduce((acc, id) => { acc[id] = isConfigured(id); return acc; }, {} as Record<PlatformId, boolean>);
}
