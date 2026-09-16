# Admin runbook (M5, ADR/A10)

> **Status: STUB — filled during M5.** MVP has **no admin UI**; support ops run via the Supabase dashboard + SQL (behind an allowlist). Never run these against production without care; all are tenant-scoped queries.

Operations to document with copy-paste SQL when M5 lands:

1. **Find a user / org / brand** — by email → `org_id` → `brand_id`.
2. **View subscription + credit balance** — derive balance from `credit_ledger` (append-only; sum of `delta`).
3. **Grant / revoke credits** — insert a `credit_ledger` row with `reason='manual_grant'|'manual_revoke'` (never mutate a counter).
4. **Re-run a failed job** — find the `jobs` row in `failed`, re-enqueue via Inngest; confirm `sources.status` transitions out of `failed`.
5. **Inspect a generation** — from `generations`: `model`, `prompt_id`, `prompt_version`, tokens, `cost_usd`, latency, error.
6. **Issue a refund** — MVP billing is concierge (manual bank transfer); record the refund in `audit_log` (no Paddle path yet).

Guardrails: every query filters by `org_id`/`brand_id`; log the operator + reason to `audit_log`; secrets never leave Vercel/Supabase secret stores.

---

## Migrations and the deploy (real, as of 2026-09)

> The section above is a pre-build stub and describes a product that no longer
> exists. This section is current.

`scripts/deploy-cpanel.sh` applies migrations itself, before the new release is
staged, so a failed migration aborts the deploy with the previous release still
serving. Three commands exist around it:

| command | what it answers |
|---|---|
| `npm run db:status` | what drizzle's ledger claims, and whether the pending ones are really absent |
| `npm run db:status -- --deep` | what the SCHEMA actually contains, ignoring the ledger entirely |
| `npm run db:baseline -- --through <tag> [--apply]` | record migrations already in the schema but missing from the ledger |

### The failure this cost a morning

drizzle decides what to run from the **latest recorded timestamp alone**. If the
ledger falls behind the schema — someone ran `drizzle-kit push`, or applied a
migration by hand — then every later `migrate` re-runs work that is already
there, fails on "relation already exists", rolls the whole batch back, and takes
the genuinely new migrations down with it. It does not recover on its own, and
`drizzle-kit migrate` is quiet enough about it that the deploy just stops.

Production sat in exactly that state: ledger at 11, schema at 21, and everything
from `0022` onward — subscriptions, invoices, publishing columns, RLS — had
never been applied. `db:baseline` recorded the eleven that were genuinely
present, stopped at the first that was not, and `migrate` then applied the
remaining fourteen.

### The rules the tools enforce

- **Never stamp a migration that is not actually applied.** Claiming work was
  done that was not is how a release goes live against a schema missing a
  column. `db:baseline` parses each migration's SQL for the objects it creates
  and checks the catalog before recording anything.
- **Stamp only a contiguous prefix.** The ledger is a watermark, so stamping
  past a gap makes the gap invisible forever.
- **Judge a migration only by what it alone leaves behind.** An object an
  earlier migration also creates, or one a later migration drops, is not
  evidence about this one.
- **When the ledger and the catalog disagree, the catalog is right.** That is
  what `--deep` is for, and a ledger that claims too much is the dangerous
  direction: `migrate` then skips work silently.

### Other things learned the hard way

- `TMPDIR` is inherited from the server environment and points at another
  application's directory this user cannot write. The deploy script pins it for
  the whole run; `ATHAR_TMPDIR` overrides. A `${TMPDIR:-default}` does NOT fix
  this — it only fills in an unset variable.
- SSH does not reach the box through Cloudflare. Deploys run from the server's
  own terminal as root: `su - athar -c '...'`, app root `/home/athar/apps/athar-ai`.
- The deploy prints a banner before each phase, so a step that is killed rather
  than failed can still be identified from the last line on screen.
