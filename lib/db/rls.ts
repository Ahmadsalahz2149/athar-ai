import { sql } from "drizzle-orm";
import type { Db, Executor } from "./forOrg";

/**
 * Row-level security support (ADR-011).
 *
 * The database enforces tenant isolation with policies keyed on two settings
 * (see drizzle/0025_row_level_security.sql):
 *
 *   app.org_id  — the workspace this transaction may see. forOrg() sets it.
 *   app.system  — the explicit escape for genuinely cross-org components.
 *
 * Both are set with `set_config(..., true)`: **transaction-local**. That is not
 * a detail. Connections are pooled, so a session-level setting would outlive
 * the request that set it and leak one tenant's scope onto the next request
 * that happened to get the same connection — which is precisely the bug RLS is
 * supposed to prevent. Every scope here therefore lives and dies with its
 * transaction.
 *
 * Enforcement is a property of the ROLE the app connects as, not of this code:
 * Postgres exempts a table's owner from its policies. Setting the scope while
 * connected as the owner is simply a no-op, which is what makes the rollout
 * safe and reversible — see docs/RLS.md.
 */

/**
 * Whether to open a scoped transaction per façade call.
 *
 * Off by default. When DATABASE_URL still points at the owning role the
 * policies do not apply, so the extra transaction would buy nothing and cost a
 * round trip per query. It is turned on in the same change that switches the
 * connection to the restricted role.
 */
export function rlsEnabled(): boolean {
  return process.env.DB_RLS === "true";
}

/** Scope a transaction to one workspace. Everything outside it becomes
 * invisible — including to a query that forgot to filter by org. */
export async function setOrgScope(tx: Executor, orgId: string): Promise<void> {
  await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);
}

/**
 * Mark a transaction as system-level: cross-org by design.
 *
 * The allowlist, which mirrors the one the ADR-005 lint rule already exempts:
 *   lib/jobs/queue.ts        — claims the next job in the whole queue
 *   lib/social/dispatch.ts   — claims every due post across tenants
 *   lib/payments/lookup.ts   — finds the org FROM a Stripe customer id
 *   lib/gdpr/erase.ts        — deletes the organization itself
 *   lib/gdpr/export.ts       — reads one org's rows through raw SQL
 *   lib/auth/bootstrap.ts    — creates the org before any scope exists
 *   lib/auth/admin.ts        — platform admin, deliberately cross-tenant
 *   lib/link/publicLookup.ts — public page, keyed by handle, no session
 *
 * Adding a call here is adding to that list. It should be as hard to justify.
 */
export async function setSystemScope(tx: Executor): Promise<void> {
  await tx.execute(sql`select set_config('app.system', 'on', true)`);
}

/**
 * Run cross-org work in one system-scoped transaction.
 *
 * The transaction is not incidental: `set_config(..., true)` is scoped to the
 * transaction, so a bare statement would set the flag and lose it before the
 * next one ran.
 *
 * With RLS off the callback runs straight on the pool — no transaction, no
 * extra round trip, and therefore nothing about today's behaviour changes.
 * Every function here is a single statement or already transactional, so the
 * two modes are equivalent.
 */
export async function asSystem<T>(db: Db, fn: (tx: Executor) => Promise<T>): Promise<T> {
  if (!rlsEnabled()) return fn(db);
  return db.transaction(async (tx) => {
    await setSystemScope(tx);
    return fn(tx);
  });
}
