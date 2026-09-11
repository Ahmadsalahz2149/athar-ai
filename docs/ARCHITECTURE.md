# Athar AI — deployed architecture

This document describes the system that is actually deployed. Proposed or future components belong in `NOT_BUILDING.md`, not here.

## Runtime and hosting

- Next.js 16 (App Router), React 19, TypeScript, `next-intl`, and CSS modules.
- Node.js 22 on Hostinger/cPanel, served through Phusion Passenger.
- The production domain is `https://athargrowth.com`; `/ar` and `/en` are the supported locales.
- `next.config.ts` emits a standalone production server and baseline browser-security headers.
- A cPanel cron calls the authenticated `/api/worker` endpoint every minute. Enqueued jobs also request an immediate best-effort worker kick.

## Data and authentication

- Supabase provides PostgreSQL, Auth, private Storage, and pgvector.
- Drizzle is the database access layer. Tenant data is accessed through `forOrg(db, orgId)`, which scopes operations to the current organization and brand.
- `DATABASE_URL`, the Supabase service-role key, provider API keys, and `WORKER_SECRET` are server-only secrets. Only `NEXT_PUBLIC_SUPABASE_URL` and the anon key are exposed to the browser.
- Email/password authentication is enabled. OAuth buttons are displayed only when the matching public feature flag is explicitly enabled and the provider is configured.

## Background jobs

- Athar uses its own PostgreSQL-backed queue (`background_jobs`), not Inngest.
- Workers claim jobs atomically, retry failures with a bounded attempt count, and recover stale claims.
- Production worker requests require `Authorization: Bearer <WORKER_SECRET>` and fail closed when the secret is absent.
- The queue handles ingestion, transcription/extraction, source analysis, and DNA synthesis.

## Content ingestion and retrieval

- Uploaded source objects are private. The server validates URLs and uploaded media before processing.
- Text and PDF content are extracted and chunked; audio/video is transcribed and chunked.
- After successful processing, the raw uploaded object is deleted. Athar currently retains extracted text/transcript chunks, not a permanent playable audio copy.
- Retrieval combines pgvector cosine similarity with a PostgreSQL full-text lexical boost, scoped by organization and brand.

## AI and credits

- Anthropic and configured media/embedding providers are called only on the server.
- Model identifiers are centralized in `lib/ai/models.ts`.
- The credit ledger is append-only. Balance writes use a per-organization PostgreSQL advisory lock and a conditional insert, preventing concurrent debits from creating a negative balance.
- Retried background jobs use idempotency keys so the same completed operation cannot charge twice.
- Sign-in, sign-up, password reset and the AI stream routes are rate limited server-side
  (`lib/rate-limit.ts`). Sign-in and reset are capped per IP *and* per email address, so a
  targeted brute force that rotates IPs is still bounded; AI streams are capped per
  organization as a burst guard in front of the provider (credits remain the real cost
  control). Counters are per-process and in-memory: they reset on restart and are not
  shared across processes, which is sufficient for the current single-process deployment
  and needs a shared store before scaling out.

## Privacy rights (GDPR / PDPL)

- Both rights are self-service from Settings → Privacy; neither needs a support ticket.
- **Access / portability** — `lib/gdpr/export.ts` builds one JSON document covering every
  table that holds workspace data. OAuth access/refresh tokens are redacted: they are
  credentials for the user's other accounts, not data about the user, and an export is a
  file people forward.
- **Erasure** — `lib/gdpr/erase.ts` deletes every org-scoped row in one transaction (a
  partial erasure would be both a broken account and a standing breach), then the stored
  brand assets, then the Supabase auth user. If other members remain in the workspace, only
  the caller's membership and auth account are removed. The confirmation (typing the
  account email) is verified server-side, so calling the action directly cannot skip it.
- A test asserts the erasure table list matches every `org_id` table in the live schema, so
  adding a table later without covering it fails CI rather than silently orphaning data.

## Product scope

- Live payment processing is enabled: Stripe Checkout for credit packs and monthly
  subscriptions, credited by signature-verified webhooks. See `docs/PAYMENTS.md`.
- Social publishing posts for real to LinkedIn, X, Facebook and Instagram once a platform's
  credentials are configured and a user connects an account; with no credentials the app
  stays export-first exactly as before. Platform *analytics* are still not connected.
  See `docs/PUBLISHING.md`.
- Operational visibility comes from the in-product admin area, structured server logs and
  Sentry (opt-in — inert without a DSN). PostHog is not installed. See `docs/MONITORING.md`.

## Deployment checklist

1. Build with Node.js 22 and `npm ci`.
2. Assemble an immutable release under `.releases`, including public assets,
   `.next/static`, and the Passenger `app.js` adapter.
3. Atomically switch `current`, then restart Passenger using `tmp/restart.txt`.
4. Keep `.env.production` readable only by the cPanel account.
5. Run `scripts/run-worker-cron.mjs` once per minute from cPanel cron under a non-overlapping `flock`.
6. Voyage embedding inputs are token-budgeted and throttled so long Arabic sources remain within the free-tier 10K TPM limit.
7. Verify `/api/health`, authentication redirects, both locales, static assets, and a real ingestion job after every deployment.
   `/api/health` reports `commit` (the short SHA the running build was compiled from, inlined by `next.config.ts`),
   so a deployment can be confirmed with `curl -s https://athargrowth.com/api/health` instead of an SSH session —
   compare it against the SHA you pushed.
