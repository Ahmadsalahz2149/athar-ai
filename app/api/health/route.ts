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

export async function GET() {
  const ts = new Date().toISOString();
  if (!db) return NextResponse.json({ ok: false, db: "unconfigured", ts }, { status: 503 });
  try {
    await db.execute(sql`select 1`);
    const queue = await queueDepth(db);
    const backlog = (queue.queued ?? 0) + (queue.running ?? 0);
    return NextResponse.json({ ok: true, db: "up", queue, backlog, dead: queue.dead ?? 0, ts });
  } catch (e) {
    return NextResponse.json({ ok: false, db: "down", error: e instanceof Error ? e.message : "error", ts }, { status: 503 });
  }
}
