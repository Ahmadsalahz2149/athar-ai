#!/usr/bin/env node
/**
 * Record migrations that are already in the schema but missing from drizzle's
 * ledger, so `drizzle-kit migrate` stops trying to re-run them.
 *
 * This exists because production's ledger had 11 rows while its schema was
 * fifteen migrations further along — the result of applying migrations by hand
 * or with `drizzle-kit push` at some point. Every deploy after that tried to
 * re-create tables that existed, failed, rolled back the whole batch, and took
 * the genuinely new migrations down with it.
 *
 * The safety rule, and the reason this is not just an INSERT: it REFUSES to
 * stamp a migration whose objects are not already present. Stamping an
 * unapplied migration tells the system work was done that was not, and the next
 * deploy goes live against a schema missing a column — which is the exact
 * failure this whole arrangement exists to prevent. A migration that is only
 * partly present is refused too: that needs a person, not a tool.
 *
 * Usage:
 *   npm run db:baseline -- --through 0025_row_level_security
 *   npm run db:baseline -- --through 0025_row_level_security --apply
 *
 * Without --apply it prints what it would do and changes nothing.
 */
import postgres from "postgres";
import { appliedMillis, databaseUrl, droppedLaterKeys, inspectMigration, priorObjectKeys, readJournal } from "./migration-lib.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const throughIdx = args.indexOf("--through");
const through = throughIdx >= 0 ? args[throughIdx + 1] : null;

if (!through) {
  console.error("Usage: npm run db:baseline -- --through <migration-tag> [--apply]");
  process.exit(2);
}

const url = databaseUrl();
if (!url) {
  console.error("No DATABASE_URL (checked the environment, .env.production, .env.local, .env).");
  process.exit(2);
}

const expected = readJournal();
const cut = expected.findIndex((e) => e.tag === through);
if (cut < 0) {
  console.error(`Unknown migration tag: ${through}`);
  console.error("Known tags:");
  for (const e of expected) console.error(`  ${e.tag}`);
  process.exit(2);
}

const needsSsl = /supabase\.(co|com)|sslmode=require/.test(url);
const sql = postgres(url, { prepare: false, ssl: needsSsl ? "require" : undefined, max: 1, connect_timeout: 10 });

try {
  const already = await appliedMillis(sql);
  const candidates = expected.slice(0, cut + 1).filter((e) => !already.has(e.millis));

  if (!candidates.length) {
    console.log("Nothing to stamp — every migration up to that tag is already in the ledger.");
    process.exit(0);
  }

  console.log(`Checking ${candidates.length} migration(s) against the real schema...\n`);

  // Stamp only a CONTIGUOUS PREFIX, stopping at the first migration that is not
  // fully present. drizzle decides what to run from the LATEST recorded
  // timestamp alone, so stamping something past a gap would make it skip the
  // gap forever — a migration that never runs and that nothing ever reports as
  // missing again. Stopping at the first hole keeps the ledger a watermark,
  // which is the only thing drizzle reads it as.
  const stampable = [];
  let stoppedAt = null;
  for (const m of candidates) {
    const { state, objects } = await inspectMigration(sql, m, priorObjectKeys(expected, expected.indexOf(m)), droppedLaterKeys(expected, expected.indexOf(m)));
    if (state === "applied") {
      stampable.push(m);
      console.log(`  stamp   ${m.tag}`);
      continue;
    }
    stoppedAt = { m, state, objects };
    console.log(`  STOP    ${m.tag}  (${state})`);
    for (const o of objects.filter((o) => !o.present)) {
      console.log(`            missing ${o.kind} ${o.extra ? `${o.extra}.` : ""}${o.name}`);
    }
    break;
  }

  if (stoppedAt) {
    const rest = candidates.length - stampable.length;
    console.log(`\nStopped at ${stoppedAt.m.tag}: it is ${stoppedAt.state} in this database.`);
    console.log(`Leaving it and the ${rest - 1} after it for \`drizzle-kit migrate\` to apply.`);
    if (stoppedAt.state === "partial") {
      console.log("It is PARTIALLY present, which no tool should paper over — look at it by hand.");
    }
  }

  if (!stampable.length) {
    console.log("\nNothing safe to stamp.");
    process.exit(1);
  }

  if (!apply) {
    console.log(`\nDry run. Re-run with --apply to record ${stampable.length} migration(s).`);
    process.exit(0);
  }

  // One transaction: a half-written ledger is worse than the problem it fixes.
  await sql.begin(async (tx) => {
    await tx`create schema if not exists drizzle`;
    await tx`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
    for (const m of stampable) {
      await tx`insert into drizzle.__drizzle_migrations ("hash", "created_at") values (${m.hash}, ${m.millis})`;
    }
  });

  console.log(`\nRecorded ${stampable.length} migration(s). Run 'npm run db:status' to confirm.`);
} finally {
  await sql.end({ timeout: 3 });
}
