#!/usr/bin/env node
/**
 * What the database actually has, versus what the repository expects.
 *
 * Written because a deploy died mid-migration with no error on screen, and
 * there was no way to answer the only question that mattered — is production's
 * schema whole? — without guessing. `drizzle-kit migrate` is quiet on success
 * and quiet when it is killed, which look identical in a terminal.
 *
 * Read-only, and prints a comparison rather than a number: the count alone
 * cannot tell you WHICH migration is missing.
 *
 * Usage (on the server, as the app user):
 *   npm run db:status
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function databaseUrl() {
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
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        return v;
      }
    }
  }
  return "";
}

const url = databaseUrl();
if (!url) {
  console.error("No DATABASE_URL (checked the environment, .env.production, .env.local, .env).");
  process.exit(2);
}

// The journal is drizzle's own record of what this checkout expects, in order.
const journalPath = path.resolve(process.cwd(), "drizzle/meta/_journal.json");
const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
const expected = journal.entries.map((e) => ({ tag: e.tag, millis: e.when }));

const needsSsl = /supabase\.(co|com)|sslmode=require/.test(url);
const sql = postgres(url, { prepare: false, ssl: needsSsl ? "require" : undefined, max: 1, connect_timeout: 10 });

try {
  const applied = await sql`
    select created_at from drizzle.__drizzle_migrations order by created_at asc
  `.catch(() => []);
  const appliedMillis = new Set(applied.map((r) => Number(r.created_at)));

  const pending = expected.filter((e) => !appliedMillis.has(e.millis));

  console.log(`expected in this checkout : ${expected.length}`);
  console.log(`applied in the database   : ${appliedMillis.size}`);
  console.log(`pending                   : ${pending.length}`);
  if (pending.length) {
    console.log("\nnot yet applied:");
    for (const p of pending) console.log(`  - ${p.tag}`);
  } else {
    console.log("\nSchema is up to date with this checkout.");
  }

  // A migration recorded in the database but absent from this checkout means
  // the server is ahead of the code — a rollback, or the wrong branch.
  const expectedMillis = new Set(expected.map((e) => e.millis));
  const unknown = [...appliedMillis].filter((m) => !expectedMillis.has(m));
  if (unknown.length) {
    console.log(`\nWARNING: ${unknown.length} migration(s) applied that this checkout does not know about.`);
    console.log("The database is ahead of the code. Check the branch before deploying.");
  }

  process.exit(pending.length ? 1 : 0);
} finally {
  await sql.end({ timeout: 3 });
}
