import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { queueDepth } from "@/lib/jobs/queue";

/**
 * Health check (INFRA phase 6). Reports DB connectivity + job-queue depth for
 * uptime probes and dashboards. Cheap: one round-trip to the DB. Returns 503 if
 * the DB is unreachable so a load balancer can route away.
 */
export const dynamic = "force-dynamic";

/** The commit this build came from, inlined by next.config.ts at build time.
 * Lets a deploy be verified with `curl .../api/health` instead of an SSH
 * session — compare it against the SHA you pushed. */
const COMMIT = process.env.ATHAR_COMMIT || "unknown";

/** Queue depth above which the system is reported degraded. Tune per traffic. */
const BACKLOG_LIMIT = Number(process.env.HEALTH_BACKLOG_LIMIT ?? 50);

/**
 * Diagnostic: `/api/health?probe=auth` verifies that THIS server can reach the
 * Supabase auth endpoint over HTTPS (the network path used by sign-in). It
 * reports only the public host and the low-level failure reason — never keys.
 * Sign-in returning "fetch failed" while the DB is up points here.
 */
async function probeAuth() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return { supabaseUrl: "MISSING", ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL is not set" };
  let host: string;
  try {
    host = new URL(raw).host;
  } catch {
    // A malformed URL (stray char / merged env line) fails here, not at fetch.
    return { supabaseUrl: JSON.stringify(raw).slice(0, 80), ok: false, reason: "URL is malformed (cannot parse)" };
  }
  const target = `${raw.replace(/\/$/, "")}/auth/v1/health`;
  const started = Date.now();
  try {
    const res = await fetch(target, { method: "GET", signal: AbortSignal.timeout(12_000) });
    return { supabaseHost: host, ok: true, status: res.status, ms: Date.now() - started };
  } catch (e) {
    // undici hides the real cause under e.cause — surface its code/message.
    const cause = (e as { cause?: { code?: string; message?: string } })?.cause;
    return {
      supabaseHost: host,
      ok: false,
      reason: e instanceof Error ? e.message : "error",
      causeCode: cause?.code,
      causeMessage: cause?.message,
      ms: Date.now() - started,
    };
  }
}

export async function GET(req: Request) {
  const ts = new Date().toISOString();
  if (new URL(req.url).searchParams.get("probe") === "auth") {
    return NextResponse.json({ probe: "auth", ...(await probeAuth()), commit: COMMIT, ts });
  }
  if (!db) return NextResponse.json({ ok: false, db: "unconfigured", commit: COMMIT, ts }, { status: 503 });
  try {
    await db.execute(sql`select 1`);
    const queue = await queueDepth(db);
    const backlog = (queue.queued ?? 0) + (queue.running ?? 0);
    const dead = queue.dead ?? 0;

    // A reachable DB is not the same as a healthy system: dead jobs mean work
    // was silently dropped, and a climbing backlog means the worker is not
    // keeping up. Both were invisible to an uptime check before, because the
    // endpoint answered 200 regardless.
    const reasons: string[] = [];
    if (dead > 0) reasons.push(`dead_jobs:${dead}`);
    if (backlog > BACKLOG_LIMIT) reasons.push(`backlog:${backlog}>${BACKLOG_LIMIT}`);
    const degraded = reasons.length > 0;

    const body = {
      ok: true,
      status: degraded ? "degraded" : "ok",
      ...(degraded ? { degraded: reasons } : {}),
      db: "up",
      commit: COMMIT,
      queue,
      backlog,
      dead,
      ts,
    };

    // Default stays 200 whenever the DB is reachable, so existing liveness
    // probes and load balancers are unaffected. `?alert=1` is the monitoring
    // view: it answers 503 when degraded, which is what an uptime check can
    // actually alert on.
    const alertMode = new URL(req.url).searchParams.get("alert") === "1";
    return NextResponse.json(body, { status: alertMode && degraded ? 503 : 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, db: "down", commit: COMMIT, error: e instanceof Error ? e.message : "error", ts }, { status: 503 });
  }
}
