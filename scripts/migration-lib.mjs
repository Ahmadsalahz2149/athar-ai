import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Shared plumbing for the migration tools.
 *
 * The hash and ordering here must match drizzle-orm's own `readMigrationFiles`
 * exactly (sha256 of the raw file, `when` from the journal as `created_at`), or
 * a row we write is a row drizzle does not recognise.
 */

export function databaseUrl() {
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

/** Every migration this checkout expects, in order, with drizzle's own hash. */
export function readJournal(dir = "drizzle") {
  const root = path.resolve(process.cwd(), dir);
  const journal = JSON.parse(fs.readFileSync(path.join(root, "meta/_journal.json"), "utf8"));
  return journal.entries.map((e) => {
    const sql = fs.readFileSync(path.join(root, `${e.tag}.sql`), "utf8");
    return {
      tag: e.tag,
      millis: e.when,
      sql,
      hash: crypto.createHash("sha256").update(sql).digest("hex"),
    };
  });
}

/**
 * The database objects a migration creates.
 *
 * Parsed from the SQL rather than hand-listed, so it cannot drift from what the
 * migration actually does. Only the four shapes this project uses, plus
 * functions — anything else is reported as unknown rather than guessed at.
 */
export function objectsCreatedBy(sql) {
  const out = [];
  const add = (kind, name, extra) => out.push({ kind, name, extra });

  for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? "([^"]+)"/gi)) add("table", m[1]);
  for (const m of sql.matchAll(/ALTER TABLE "([^"]+)" ADD COLUMN(?: IF NOT EXISTS)? "([^"]+)"/gi)) add("column", m[2], m[1]);
  for (const m of sql.matchAll(/CREATE(?: UNIQUE)? INDEX(?: IF NOT EXISTS)? "([^"]+)"/gi)) add("index", m[1]);
  for (const m of sql.matchAll(/CREATE POLICY "([^"]+)" ON "([^"]+)"/gi)) add("policy", m[1], m[2]);
  for (const m of sql.matchAll(/CREATE(?: OR REPLACE)? FUNCTION (?:public\.)?"?([a-z0-9_]+)"?\s*\(/gi)) add("function", m[1]);

  return out;
}

/** Does the database already have this object? */
export async function objectExists(sql, obj) {
  switch (obj.kind) {
    case "table": {
      const r = await sql`select 1 from information_schema.tables where table_schema = 'public' and table_name = ${obj.name} limit 1`;
      return r.length > 0;
    }
    case "column": {
      const r = await sql`select 1 from information_schema.columns where table_schema = 'public' and table_name = ${obj.extra} and column_name = ${obj.name} limit 1`;
      return r.length > 0;
    }
    case "index": {
      const r = await sql`select 1 from pg_indexes where schemaname = 'public' and indexname = ${obj.name} limit 1`;
      return r.length > 0;
    }
    case "policy": {
      const r = await sql`select 1 from pg_policies where schemaname = 'public' and policyname = ${obj.name} and tablename = ${obj.extra} limit 1`;
      return r.length > 0;
    }
    case "function": {
      const r = await sql`select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = ${obj.name} limit 1`;
      return r.length > 0;
    }
    default:
      return null;
  }
}

export const objectKey = (o) => `${o.kind}:${o.extra ?? ""}:${o.name}`;

/**
 * Whether a migration's effects are already in the database.
 *
 * "applied"  — every object it alone creates is present
 * "absent"   — none of them are
 * "partial"  — some are: the dangerous case, and the one a person must look at
 * "unknown"  — it creates nothing this can check, or nothing DISTINCTIVE
 *
 * `priorKeys` is what every earlier migration already creates, and excluding it
 * is what makes the answer mean anything. `0026` re-creates an index that `0018`
 * created (`CREATE ... IF NOT EXISTS`), so at `0025` that index is present and a
 * naive check calls `0026` "partially applied" — alarming, and wrong: the
 * migration has not run at all. An object an earlier migration also creates is
 * not evidence about this one.
 */
export async function inspectMigration(sql, migration, priorKeys = new Set()) {
  const all = objectsCreatedBy(migration.sql);
  const distinctive = all.filter((o) => !priorKeys.has(objectKey(o)));
  if (!distinctive.length) return { state: "unknown", objects: [] };

  const checked = [];
  for (const o of distinctive) checked.push({ ...o, present: await objectExists(sql, o) });

  const present = checked.filter((c) => c.present).length;
  if (present === checked.length) return { state: "applied", objects: checked };
  if (present === 0) return { state: "absent", objects: checked };
  return { state: "partial", objects: checked };
}

/** Everything the migrations before `index` create — the baseline against which
 * the next one's presence is judged. */
export function priorObjectKeys(expected, index) {
  const keys = new Set();
  for (let i = 0; i < index; i++) for (const o of objectsCreatedBy(expected[i].sql)) keys.add(objectKey(o));
  return keys;
}

export async function appliedMillis(sql) {
  const rows = await sql`select created_at from drizzle.__drizzle_migrations order by created_at asc`.catch(() => []);
  return new Set(rows.map((r) => Number(r.created_at)));
}
