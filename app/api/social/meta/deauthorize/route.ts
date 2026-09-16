import { NextResponse, type NextRequest } from "next/server";
import { parseSignedRequest } from "@/lib/social/meta-signed-request";
import { deauthorizeMetaUser } from "@/lib/social/metaDeletion";
import { consume } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { log } from "@/lib/log";

/**
 * Meta's deauthorize callback (Phase 6).
 *
 * Fired when someone removes the app from their Facebook account. Their tokens
 * die at that moment, so holding on to them keeps something useless and
 * sensitive — and the publisher would go on trying to use them until it failed.
 *
 * Same signed_request verification as the deletion callback, for the same
 * reason: this endpoint is public, and it deletes.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!consume(`meta-deauth:${await clientIp()}`, 60, 10 * 60_000).ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let signed = "";
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      signed = ((await req.json()) as { signed_request?: string }).signed_request ?? "";
    } else {
      signed = String((await req.formData()).get("signed_request") ?? "");
    }
  } catch {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }

  const parsed = parseSignedRequest(signed, process.env.META_CLIENT_SECRET ?? "");
  if (!parsed.ok) {
    log.info("meta.deauth_rejected", { reason: parsed.reason });
    return NextResponse.json({ error: parsed.reason }, { status: parsed.reason === "no_secret" ? 503 : 400 });
  }

  const removed = await deauthorizeMetaUser(parsed.userId);
  // Meta does not read a body here; 200 is the whole contract.
  return NextResponse.json({ ok: true, removed });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "meta_deauthorize", method: "POST" });
}
