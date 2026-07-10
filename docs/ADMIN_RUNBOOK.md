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
