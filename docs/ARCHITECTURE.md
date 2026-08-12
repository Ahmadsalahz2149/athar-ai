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

## Product scope

- Billing screens clearly label unavailable checkout paths as coming soon; live payment processing is not enabled.
- Social publishing and platform analytics are not connected. Export-first workflows are the current supported behavior.
- Operational visibility is provided by the in-product admin area and structured server logs. Sentry and PostHog are not installed.

## Deployment checklist

1. Build with Node.js 22 and `npm ci`.
2. Copy public assets and `.next/static` into the standalone output.
3. Restart Passenger using `tmp/restart.txt`.
4. Keep `.env.production` readable only by the cPanel account.
5. Run `scripts/run-worker-cron.mjs` once per minute from cPanel cron.
6. Verify `/api/health`, authentication redirects, both locales, and a real ingestion job after every deployment.
