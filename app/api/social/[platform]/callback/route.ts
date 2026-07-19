import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { isPlatform } from "@/lib/social/registry";
import { exchangeCode, publicOrigin } from "@/lib/social/oauth";

/**
 * OAuth callback (Phase 7.3): validate CSRF state, exchange the code for tokens,
 * and store the connection for the current brand. Any failure returns to the
 * platforms settings tab with an error flag — never a raw crash.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const url = new URL(req.url);
  const jar = await cookies();
  const locale = jar.get("oauth_locale")?.value === "en" ? "en" : "ar";
  const settings = `${publicOrigin(url.origin)}/${locale}/settings?tab=platforms`;

  const fail = (reason: string) => {
    const res = NextResponse.redirect(`${settings}&social_error=${reason}`);
    for (const c of ["oauth_state", "oauth_verifier", "oauth_locale"]) res.cookies.delete(c);
    return res;
  };

  if (!isPlatform(platform)) return fail("unknown");
  if (url.searchParams.get("error")) return fail("denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = jar.get("oauth_state")?.value;
  if (!code || !state || !savedState || state !== savedState) return fail("state");

  const ctx = await currentContext();
  if (!db || !ctx) return fail("session");

  try {
    const tokens = await exchangeCode(platform, url.origin, code, jar.get("oauth_verifier")?.value);
    await forOrg(db, ctx.orgId).saveConnection(ctx.brandId, platform, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    });
    const res = NextResponse.redirect(`${settings}&social_connected=${platform}`);
    for (const c of ["oauth_state", "oauth_verifier", "oauth_locale"]) res.cookies.delete(c);
    return res;
  } catch {
    return fail("exchange");
  }
}
