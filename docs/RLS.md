# Row-level security (ADR-011)

Tenant isolation enforced by Postgres, underneath the `forOrg()` façade.

## What it does

Every tenant table carries a policy:

```sql
org_id = nullif(current_setting('app.org_id', true), '')::uuid
OR current_setting('app.system', true) = 'on'
```

`forOrg()` sets `app.org_id` at the start of each transaction. With the setting
absent the comparison is NULL, nothing matches, and the query returns **zero
rows** — deny by default. That is the whole value: a query that forgets to
filter by org stops being a cross-tenant leak and becomes an empty result.

Both settings use `set_config(..., true)` — **transaction-local**. Connections
are pooled, so a session-level setting would outlive the request that set it and
apply to whoever got that connection next, which is the exact bug RLS is meant
to prevent.

## Why it is off today, and how to turn it on

Postgres exempts a table's **owner** from its own policies unless `FORCE ROW
LEVEL SECURITY` is set. The application currently connects as the owner, so
applying migration 0025 changed nothing about how the app behaves. The policies
are live already — they simply do not apply to the owner.

Enforcement is therefore a property of the *role*, not of a code flag:

```bash
# 1. Give the role a password (it is created NOLOGIN and passwordless by the
#    migration, because a credential must never live in a repository).
psql "$DATABASE_URL" -c "ALTER ROLE athar_app WITH LOGIN PASSWORD '<a long random password>'"

# 2. Point the app at it, and tell it to set the scope.
#    In .env.production:
#      DATABASE_URL=postgres://athar_app:<password>@<host>:<port>/<db>?sslmode=require
#      DB_RLS=true

# 3. Restart.
```

To roll back, put the owner URL back and remove `DB_RLS`. Nothing else changes;
no migration is reversed.

**Migrations keep using the owner URL.** `athar_app` has no DDL rights by
design, so run `npm run db:migrate` with the owning credential, not the app's.

`DB_RLS` and the role must move together. On its own, `DB_RLS=true` against the
owner connection just adds a transaction per query for no benefit; the role
without `DB_RLS=true` would leave every query unscoped — which fails closed
(empty results), loudly and immediately, not silently.

## The system escape

A few components are cross-org by their nature and opt out explicitly through
`asSystem()` in `lib/db/rls.ts`:

| Module | Why it cannot be org-scoped |
|---|---|
| `lib/jobs/queue.ts` | claims the next job in the whole queue |
| `lib/social/dispatch.ts` | claims every due post across tenants |
| `lib/payments/lookup.ts` | finds the org *from* a Stripe customer id |
| `lib/gdpr/erase.ts` | deletes the organization row itself |
| `lib/gdpr/export.ts` | reads every table by raw name |
| `lib/auth/bootstrap.ts` | creates the org before any scope exists |
| `lib/db/admin.ts` | platform admin, deliberately cross-tenant |
| `lib/link/publicLookup.ts` | public page keyed by handle, no session |

This is the same list the ADR-005 lint rule already exempts from the façade.
Adding to it should be as hard to justify.

## What it does not protect against

Code that can run arbitrary SQL as the application can also set `app.system` and
see everything. No same-role mechanism can prevent that, and pretending
otherwise would be worse than saying it plainly. The threat this addresses is
the realistic one: a query that forgets its `WHERE org_id`, a new table wired up
without the façade, a join that widens by accident. Against those, the database
now says no.

## Verifying it

`tests/rls.test.ts` connects as the restricted role — not the owner, which would
prove nothing — and checks that an unscoped query sees nothing, a scoped one
sees only its own workspace, a write aimed at another workspace is rejected, and
the system scope still crosses tenants. It skips itself when the role has no
local password, so a fresh checkout does not fail.

To run it locally, apply migration 0025 and give the role the password
`localtest` (or point `DATABASE_URL_RLS` at your own restricted connection).
