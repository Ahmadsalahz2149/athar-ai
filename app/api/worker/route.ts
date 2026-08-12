import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runBatch } from "@/lib/jobs/runner";
import { reapStale } from "@/lib/jobs/queue";
import "@/lib/jobs/handlers"; // registers all handlers as a side effect

/**
 * Job worker (INFRA phase 1). Drains a batch of pending jobs. Called by:
 *  - `after()` fire-and-forget on enqueue (phase 2) for immediate processing,
 *  - the client poll fallback while a user waits,
 *  - the production cPanel cron via `scripts/run-worker-cron.mjs`.
 *
 * Guarded by WORKER_SECRET in production. Local development may run without
 * one, but a production misconfiguration fails closed instead of exposing a
 * public, resource-intensive queue drain endpoint.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 600;

function authorized(req: Request): boolean {
  const secret = process.env.WORKER_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearer === secret;
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
