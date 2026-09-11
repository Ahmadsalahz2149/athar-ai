import fs from "node:fs";
import path from "node:path";
import type { Config } from "drizzle-kit";

/**
 * drizzle-kit runs OUTSIDE Next, so it never sees `.env.production` /
 * `.env.local` the way the app does — which made `npm run db:migrate` on the
 * server fail with an empty url until the value was exported by hand. Read it
 * from the same files the app uses when the variable isn't already in the
 * environment. (Same shape as the loader the DB tests use.)
 */
function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const file of [".env.production", ".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const i = s.indexOf("=");
      if (i > 0 && s.slice(0, i).trim() === "DATABASE_URL") {
        let v = s.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return v;
      }
    }
  }
  return "";
}

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl() },
} satisfies Config;
