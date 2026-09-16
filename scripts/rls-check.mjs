#!/usr/bin/env node
/**
 * Is row-level security actually enforcing anything?
 *
 * ADR-011 made enforcement a property of the ROLE the app connects as, not of a
 * code flag — Postgres exempts a table's owner from its own policies. That is
 * what makes the rollout safe and reversible, and it is also what makes it
 * impossible to tell by reading the code whether isolation is live. This tells
 * you, by asking the database.
 *
 * Read-only. It never changes a role, a policy or a setting.
 *
 * Usage:
 *   npm run db:rls-check
 *       Reports on DATABASE_URL: which role, whether it is exempt, how many
 *       tenant tables carry a policy, and whether an unscoped read really
 *       returns nothing.
 *
 *   DATABASE_URL_RLS='postgres://athar_app:...' npm run db:rls-check
 *       ALSO connects as the candidate role and runs the isolation probes
 *       against it — so you find out the switch works BEFORE you make it,
 *       instead of finding out from a production page that returns nothing.
 */
import postgres from "postgres";
import { databaseUrl } from "./migration-lib.mjs";

const ok = (s) => `  OK    ${s}`;
const bad = (s) => `  FAIL  ${s}`;
const info = (s) => `  ..    ${s}`;

let failures = 0;
function check(condition, good, wrong) {
  if (condition) console.log(ok(good));
  else {
    console.log(bad(wrong));
    failures++;
  }
}

function connect(url) {
  const needsSsl = /supabase\.(co|com)|sslmode=require/.test(url);
  return postgres(url, { prepare: false, ssl: needsSsl ? "require" : undefined, max: 1, connect_timeout: 10 });
}

/** Tables that carry an org_id are the ones isolation is about. */
async function tenantTables(sql) {
  const rows = await sql`
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'org_id'
    order by table_name`;
  return rows.map((r) => r.table_name);
}

const url = databaseUrl();
if (!url) {
  console.error("No DATABASE_URL (checked the environment, .env.production, .env.local, .env).");
  process.exit(2);
}

const sql = connect(url);
let appSql = null;

try {
  console.log("Schema\n");

  const tables = await tenantTables(sql);
  const enabled = await sql`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relrowsecurity and c.relname = any(${tables})`;
  const policies = await sql`select count(*)::int as n from pg_policies where schemaname = 'public'`;

  const missing = tables.filter((t) => !enabled.some((e) => e.relname === t));
  console.log(info(`${tables.length} tenant tables (they carry org_id)`));
  check(
    missing.length === 0,
    `every tenant table has row level security enabled, ${policies[0].n} policies in place`,
    `${missing.length} tenant table(s) have NO row level security: ${missing.join(", ")}`,
  );

  // FORCE matters only for the owner. Without it the owner is exempt, which is
  // deliberate here — it is what lets the policies ship dormant.
  const forced = await sql`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relforcerowsecurity and c.relname = any(${tables})`;
  console.log(info(`${forced.length} of ${tables.length} tables also FORCE it (the owner is exempt on the rest, by design)`));

  console.log("\nThis connection\n");

  const [who] = await sql`select current_user as role, session_user as session`;
  console.log(info(`connected as ${who.role}`));

  const [{ owns }] = await sql`
    select count(*)::int as owns from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = any(${tables}) and pg_get_userbyid(c.relowner) = current_user`;
  const isOwner = owns > 0;

  // The probe that settles it: read a tenant table with NO scope set. Under
  // real enforcement this is zero rows, whatever the table contains.
  const probeTable = tables.includes("drafts") ? "drafts" : tables[0];
  const [{ n: unscoped }] = await sql.unsafe(`select count(*)::int as n from ${probeTable}`);
  const [{ n: total }] = await sql.unsafe(`select count(*)::int as n from ${probeTable}`).catch(() => [{ n: null }]);

  if (isOwner) {
    console.log(info(`this role owns the tables, so policies do not apply to it (${unscoped} rows readable unscoped)`));
    console.log(info("isolation is DORMANT on this connection — expected until the switch is made"));
    console.log(`\n  To enforce, point DATABASE_URL at athar_app and set DB_RLS=true. See docs/RLS.md.`);
    console.log(`  Verify the candidate first: DATABASE_URL_RLS='postgres://athar_app:...' npm run db:rls-check`);
  } else {
    check(unscoped === 0, "an unscoped read returns nothing — isolation is LIVE", `an unscoped read returned ${total} rows: policies are NOT applying to this role`);
  }

  // --- The candidate role, if one was supplied --------------------------------

  const candidate = process.env.DATABASE_URL_RLS;
  if (candidate) {
    console.log("\nCandidate role (DATABASE_URL_RLS)\n");
    appSql = connect(candidate);

    const [cwho] = await appSql`select current_user as role`;
    console.log(info(`connected as ${cwho.role}`));

    const [{ n: none }] = await appSql.unsafe(`select count(*)::int as n from ${probeTable}`);
    check(none === 0, "unscoped: reads nothing (deny by default)", `unscoped: read ${none} rows — this role is NOT subject to the policies`);

    // Scoped to a real workspace, it must see that workspace and no other.
    const orgs = await sql`select id from organizations limit 2`;
    if (orgs.length) {
      const scoped = await appSql.begin(async (tx) => {
        await tx`select set_config('app.org_id', ${orgs[0].id}, true)`;
        const [r] = await tx.unsafe(`select count(*)::int as n from ${probeTable} where org_id <> '${orgs[0].id}'`);
        return r.n;
      });
      check(scoped === 0, "scoped to one workspace: no other workspace's rows are visible", `scoped read leaked ${scoped} rows from another workspace`);

      const sys = await appSql.begin(async (tx) => {
        await tx`select set_config('app.system', 'on', true)`;
        const [r] = await tx.unsafe(`select count(*)::int as n from ${probeTable}`);
        return r.n;
      });
      console.log(info(`system scope reads ${sys} rows (the documented escape — the job queue and public pages need it)`));
    } else {
      console.log(info("no organizations yet, so the scoped probe was skipped"));
    }

    // A role that cannot write is a role the app cannot run as.
    const canWrite = await appSql`
      select has_table_privilege(current_user, ${probeTable}, 'INSERT') as ins,
             has_table_privilege(current_user, ${probeTable}, 'UPDATE') as upd,
             has_table_privilege(current_user, ${probeTable}, 'DELETE') as del`;
    const w = canWrite[0];
    check(w.ins && w.upd && w.del, "the role has INSERT/UPDATE/DELETE on tenant tables", "the role is missing write privileges — the app cannot run as it");
  }

  console.log("");
  if (failures) {
    console.log(`${failures} check(s) failed. Do not switch enforcement until they pass.`);
    process.exit(1);
  }
  console.log("All checks passed.");
} finally {
  await sql.end({ timeout: 3 });
  if (appSql) await appSql.end({ timeout: 3 });
}
