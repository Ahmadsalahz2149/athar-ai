import { NextResponse, type NextRequest } from "next/server";
import { parseSignedRequest } from "@/lib/social/meta-signed-request";
import { deleteMetaUserData } from "@/lib/social/metaDeletion";
import { publicOrigin } from "@/lib/social/oauth";
import { consume } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { log } from "@/lib/log";

/**
 * Meta's data deletion callback (Phase 6).
 *
 * Required for App Review of the publishing permissions, and correct on its own
 * terms: a person telling Facebook to erase their data is telling us too.
 *
 * Meta POSTs `signed_request` as a form field and expects JSON back:
 *   { "url": "<where the person can check on it>", "confirmation_code": "..." }
 *
 * The signature is the whole security model. This endpoint is public and
 * unauthenticated by design, so without verification anyone who can POST to it
 * could delete any account's connections by guessing a user id. A request that
 * fails verification is refused, not honoured.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = await clientIp();
  // An open endpoint that performs a delete is worth a ceiling, even a generous
  // one: Meta sends these one at a time, and nothing legitimate arrives in bulk.
  if (!consume(`meta-deletion:${ip}`, 60, 10 * 60_000).ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let signed = "";
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { signed_request?: string };
      signed = body.signed_request ?? "";
    } else {
      const form = await req.formData();
      signed = String(form.get("signed_request") ?? "");
    }
  } catch {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }

  const parsed = parseSignedRequest(signed, process.env.META_CLIENT_SECRET ?? "");
  if (!parsed.ok) {
    // Logged without the payload: a rejected request is precisely the one whose
    // contents should not be trusted into our logs.
    log.info("meta.deletion_rejected", { reason: parsed.reason });
    const status = parsed.reason === "no_secret" ? 503 : 400;
    return NextResponse.json({ error: parsed.reason }, { status });
  }

  const { confirmationCode, deleted } = await deleteMetaUserData(parsed.userId);

  // Meta shows this URL to the person, so it must be a page they can actually
  // open and read — not an API route.
  const origin = publicOrigin(req.nextUrl.origin);
  return NextResponse.json({
    url: `${origin}/ar/data-deletion?code=${encodeURIComponent(confirmationCode)}`,
    confirmation_code: confirmationCode,
    deleted,
  });
}

/** Meta occasionally probes the URL with a GET while configuring it. Answer
 * plainly rather than with a 405 that looks like a broken endpoint. */
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "meta_data_deletion", method: "POST" });
}
