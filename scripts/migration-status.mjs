#!/usr/bin/env node
/**
 * What the database actually has, versus what the repository expects.
 *
 * Written because a deploy died inside `drizzle-kit migrate` with no error on
 * screen, and there was no way to answer the only question that mattered — is
 * production's schema whole? — without guessing.
 *
 * It reports TWO different things, and the difference between them is the whole
 * point:
 *
 *   - what drizzle's ledger says has been applied
 *   - what the schema actually contains
 *
 * Those drift apart the moment anyone runs `drizzle-kit push`, or applies a
 * migration by hand. When they do, the next `migrate` tries to re-run work that
 * is already there, fails on "relation already exists", rolls the whole batch
 * back, and the deploy stops — which is exactly what happened here.
 *
 * Read-only.
 *
 * Usage:
 *   npm run db:status           what the ledger says, checked where it matters
 *   npm run db:status -- --deep every migration checked against the catalog,
 *                               ignoring the ledger entirely
 *
 * `--deep` exists because a ledger can be wrong in BOTH directions. A ledger
 * that is missing rows makes `migrate` re-run applied work and fail loudly. A
 * ledger that claims rows it should not makes `migrate` skip work silently, and
 * the plain report above would call that "up to date" — the schema would be
 * missing columns the running code expects, and nothing would say so. When the
 * two disagree, the catalog is the truth and the ledger is a claim.
 */
import postgres from "postgres";
import { appliedMillis, databaseUrl, droppedLaterKeys, inspectMigration, priorObjectKeys, readJournal } from "./migration-lib.mjs";

const deep = process.argv.includes("--deep");

const url = databaseUrl();
if (!url) {
  console.error("No DATABASE_URL (checked the environment, .env.production, .env.local, .env).");
  process.exit(2);
}

const expected = readJournal();
const needsSsl = /supabase\.(co|com)|sslmode=require/.test(url);
const sql = postgres(url, { prepare: false, ssl: needsSsl ? "require" : undefined, max: 1, connect_timeout: 10 });

const MARK = { applied: "already in the schema", absent: "not applied", partial: "PARTIALLY applied", unknown: "cannot tell from the catalog" };

try {
  const applied = await appliedMillis(sql);
  const pending = expected.filter((e) => !applied.has(e.millis));

  console.log(`expected in this checkout : ${expected.length}`);
  console.log(`recorded in the ledger    : ${applied.size}`);
  console.log(`pending per the ledger    : ${pending.length}`);

  if (deep) {
    console.log("\nEvery migration, checked against the catalog (the ledger is ignored):\n");
    const bad = [];
    for (const m of expected) {
      const { state, objects } = await inspectMigration(sql, m, priorObjectKeys(expected, expected.indexOf(m)), droppedLaterKeys(expected, expected.indexOf(m)));
      if (state === "absent" || state === "partial") bad.push({ m, state, objects });
      if (state !== "applied") console.log(`  ${m.tag.padEnd(34)} ${MARK[state]}`);
    }
    if (!bad.length) {
      console.log("  (every migration's objects are present)\n");
      console.log("The schema really does match this checkout.");
      process.exit(0);
    }
    console.log(`\n${bad.length} migration(s) are NOT in the schema:`);
    for (const b of bad) {
      console.log(`\n  ${b.m.tag} (${b.state})`);
      for (const o of b.objects.filter((o) => !o.present)) {
        console.log(`    missing ${o.kind} ${o.extra ? `${o.extra}.` : ""}${o.name}`);
      }
    }
    console.log("\nIf the ledger calls these applied, it is lying and the running code is");
    console.log("reading columns that do not exist. Fix the schema before anything else.");
    process.exit(1);
  }

  if (!pending.length) {
    console.log("\nThe ledger says everything is applied.");
    console.log("Run `npm run db:status -- --deep` to check that against the real schema.");
  } else {
    console.log("\nWhat the ledger calls pending, checked against the real schema:\n");
    let realWork = 0;
    let stale = 0;
    let partial = 0;
    for (const m of pending) {
      const { state } = await inspectMigration(sql, m, priorObjectKeys(expected, expected.indexOf(m)), droppedLaterKeys(expected, expected.indexOf(m)));
      if (state === "applied") stale++;
      else if (state === "partial") partial++;
      else if (state === "absent") realWork++;
      console.log(`  ${m.tag.padEnd(34)} ${MARK[state]}`);
    }

    console.log("");
    if (stale) {
      console.log(`${stale} migration(s) are already in the schema but missing from the ledger.`);
      console.log("`drizzle-kit migrate` will try to re-run them and fail. Stamp them with:");
      console.log("  npm run db:baseline -- --through <tag>");
    }
    if (partial) {
      console.log(`\n${partial} migration(s) are PARTIALLY present. Do not stamp these — look at them by hand.`);
    }
    if (realWork) console.log(`${realWork} migration(s) genuinely need to run.`);
  }

  // A migration recorded but absent from this checkout means the server is
  // ahead of the code — a rollback, or the wrong branch.
  const expectedMillis = new Set(expected.map((e) => e.millis));
  const unknown = [...applied].filter((m) => !expectedMillis.has(m));
  if (unknown.length) {
    console.log(`\nWARNING: ${unknown.length} migration(s) recorded that this checkout does not know about.`);
    console.log("The database is ahead of the code. Check the branch before deploying.");
  }

  process.exit(pending.length ? 1 : 0);
} finally {
  await sql.end({ timeout: 3 });
}
