import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Graceful DB client. Returns null when DATABASE_URL is unset so the app still
 * boots for the Stage-1 demo. `postgres()` is lazy — no connection until a query.
 */
const url = process.env.DATABASE_URL;

export const db = url
  ? drizzle(postgres(url, { prepare: false }), { schema })
  : null;

export function hasDb(): boolean {
  return db !== null;
}

export { schema };
