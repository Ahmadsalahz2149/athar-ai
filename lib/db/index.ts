import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Graceful DB client. Returns null when DATABASE_URL is unset so the app still
 * boots without a DB. `postgres()` is lazy — no connection until a query.
 * Supabase (pooler, port 6543) requires SSL and transaction mode (no prepared
 * statements), so we set ssl + prepare:false for it.
 */
const url = process.env.DATABASE_URL;
const needsSsl = !!url && /supabase\.(co|com)|sslmode=require/.test(url);

export const db = url
  ? drizzle(postgres(url, { prepare: false, ssl: needsSsl ? "require" : undefined }), { schema })
  : null;

export function hasDb(): boolean {
  return db !== null;
}

export { schema };
