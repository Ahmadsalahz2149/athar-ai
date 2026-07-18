import { after } from "next/server";
import { db } from "@/lib/db";
import { runBatch } from "./runner";
import "./handlers"; // ensure handlers are registered

/**
 * Fire-and-forget worker trigger (INFRA phase 2). Called from a server action
 * right after enqueueing: `after()` runs the drain once the response has been
 * sent, so the user isn't blocked but processing starts immediately. Durable
 * cron (phase 7) + reapStale cover cases where this process dies mid-run.
 */
export function kickWorker(): void {
  if (!db) return;
  const database = db;
  after(async () => {
    try {
      await runBatch(database, `after_${process.pid}`, 5);
    } catch {
      /* the durable worker/reaper will pick up anything left behind */
    }
  });
}
