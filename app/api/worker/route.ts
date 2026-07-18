import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runBatch } from "@/lib/jobs/runner";
import { reapStale } from "@/lib/jobs/queue";
import "@/lib/jobs/handlers"; // registers all handlers as a side effect

/**
 * Job worker (INFRA phase 1). Drains a batch of pending jobs. Called by:
 *  - `after()` fire-and-forget on enqueue (phase 2) for immediate processing,
 *  - the client poll fallback while a user waits,
 *  - a durable cron trigger (phase 7 — needs deploy config).
 *
 * Optionally guarded by WORKER_SECRET: when set, callers must send it as a
 * Bearer token or `?key=`. When unset (local dev), the endpoint is open.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.WORKER_SECRET;
  if (!secret) return true;
  const url = new URL(req.url);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearer === secret || url.searchParams.get("key") === secret;
}

async function handle(req: Request) {
  if (!db) return NextResponse.json({ ok: false, error: "no_db" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const workerId = `w_${process.pid}_${Date.now()}`;
  const reaped = await reapStale(db); // recover jobs abandoned by a crashed worker
  const processed = await runBatch(db, workerId, 10);
  return NextResponse.json({ ok: true, processed, reaped });
}

export async function POST(req: Request) {
  return handle(req);
}

// GET is convenient for cron pingers and manual local runs.
export async function GET(req: Request) {
  return handle(req);
}
