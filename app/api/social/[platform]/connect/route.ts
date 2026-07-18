import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/current";
import { isPlatform, isConfigured } from "@/lib/social/registry";
import { buildAuthorizeUrl, randomState, pkce } from "@/lib/social/oauth";
import { PLATFORMS } from "@/lib/social/registry";

/**
 * Start the OAuth connect flow for a platform (Phase 7.3). Requires a session,
 * requires the platform's client keys to be configured, then redirects to the
 * provider's authorize page with CSRF state (+ PKCE for X) stashed in httpOnly
 * cookies for the callback to validate.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") === "en" ? "en" : "ar";
  const settings = `${url.origin}/${locale}/settings?tab=platforms`;

  if (!isPlatform(platform)) return NextResponse.redirect(`${settings}&social_error=unknown`);
  const ctx = await currentContext();
  if (!ctx) return NextResponse.redirect(`${url.origin}/${locale}/login`);
  if (!isConfigured(platform)) return NextResponse.redirect(`${settings}&social_error=not_configured`);

  const state = randomState();
  const usesPkce = PLATFORMS[platform].usesPkce;
  const pair = usesPkce ? pkce() : null;
  const authorizeUrl = buildAuthorizeUrl(platform, url.origin, state, pair?.challenge);

  const res = NextResponse.redirect(authorizeUrl);
  const cookieOpts = { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set("oauth_state", state, cookieOpts);
  res.cookies.set("oauth_locale", locale, cookieOpts);
  if (pair) res.cookies.set("oauth_verifier", pair.verifier, cookieOpts);
  return res;
}
