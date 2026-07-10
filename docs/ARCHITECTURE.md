# Athar AI — Architecture (v4)

Stack, tenancy (`db.forOrg()` + CI test + RLS backstop), data model (`dna_versions` + `brands.current_dna_version_id`; `content_dna` dropped; no `webhook_events` in MVP), retrieval (pgvector + Arabic chunking + hybrid; DNA on stratified sample), AI pipeline (injection-safe delimited-data + no-tools + structured output; SSRF-safe URL ingestion; dialect module; DNA-match composite), payments (interface + empty adapters + `credit_ledger` only; Paddle post-MVP), i18n (`/ar`+`/en`; new-screen copy founder-authored), observability (Sentry + PostHog funnel; admin = runbook) — **all as v3.**

**New in v4 — model-ID single source of truth.** All Claude model ID strings live in **`lib/ai/models.ts`** (e.g. `OPUS='claude-opus-4-8'`, `SONNET='claude-sonnet-5'`, `HAIKU='claude-haiku-4-5'`), imported everywhere; **no model name is hardcoded at any call site.** Tier selection (Haiku classify/extract · Sonnet drafts · Opus DNA/polish) references these constants.

**Media handling (fix).** After transcription + chunking, **transcode source audio to 24 kbps mono Opus (~20 MB per 2-hr podcast) and keep it permanently**; **delete the original upload.** This preserves click-a-quote-to-hear-the-moment (chunks cite Opus timestamps) while keeping storage near the low COGS figure.

---

## Full detail carried from v2 (still authoritative)

### Stack
Next.js 15 (App Router)+TS; `next-intl`; CSS-variable tokens + logical properties; Supabase (Postgres + Auth + Storage + pgvector); Drizzle; Inngest; Resend; Anthropic Claude (server-only, IDs via `lib/ai/models.ts`); transcription + embedding providers per `EVAL_TRANSCRIPTION.md` / `EVAL_RETRIEVAL.md` (adapters); Sentry + PostHog; Vercel. **No payment SDK in MVP** — only the `PaymentProvider` interface with empty `paddle`/`stripe` adapters (concierge billing is manual, off-code).

### Tenancy (A2/A3)
`organizations → memberships(user,role)` and `organizations → brands (1..n)`; every tenant row carries `org_id` AND `brand_id`. **`db.forOrg(orgId)` façade** injects scope; lint rule forbids raw tenant queries outside it; **RLS on as backstop** (Drizzle's pooled credential bypasses RLS, so the façade is the real boundary). **CI tenancy test** (2-brand org) proves cross-tenant read/update/delete is impossible via API routes, server actions, signed Storage URLs.

### Data model (A6 — English enums only)
- Core: `users`, `organizations`, `memberships`, `brands` (+ **`current_dna_version_id`**), `brand_profiles` (onboarding answers: field/audience/brandType/dialect/goals[]/platforms[]/frequency/contentStyle/acctType).
- Content: `sources` (title, kind, category, storage_path, status enum `uploaded|extracting|transcribing|analyzing|ready|failed`, progress_pct, tags[], counts), `source_chunks` (id, source_id, brand_id, org_id, chunk_index, text, token_count, `embedding vector(N)`, metadata jsonb), `analyses` (summary, ideas[], quotes[] w/ page/timestamp), **`dna_versions`** (id, brand_id, version, payload jsonb, completion_pct, built_from_source_ids[], created_at) — `content_dna` dropped (C6); `brands.current_dna_version_id` points at the head. `ideas` (title, emoji, format, source_id, score, status enum `new|saved|used`, bucket enum), `drafts` (platform, format, tone, hook_variants[], body, selected_variant, status, `dna_version_id`), `posts` (id, draft_id, brand_id, platform, external_post_id, published_at, url).
- Ops/economics: `credit_ledger` (append-only; delta, reason, ref_type, ref_id, balance_after; balance derived — no mutable counters), `generations` (operation, model, prompt_id, prompt_version, input/output/cached tokens, cost_usd, latency_ms, status, error, user_rating), `jobs` (kind, ref_id, state, attempts, last_error, timestamps — Inngest mirror), `metrics_daily` (brand_id, platform, external_post_id, date, impressions/engagements/clicks/follows), `subscriptions` (present, unused in MVP), `audit_log`. Soft-delete (`deleted_at`) + Storage-purge cascade. **No `webhook_events` in MVP** (deferred with Paddle).

### Retrieval (A1)
`pgvector` on Supabase. Arabic **semantic/paragraph chunking with overlap** (never naive whitespace split); store boundaries so quotes cite PDF page or Opus timestamp. **Hybrid retrieval:** vector similarity + lexical (Postgres FTS with an Arabic-workable config, or trigram/BM25 — choice documented in `DECISIONS.md`). Every content-reading Claude call retrieves top-K chunks; **DNA build reads a stratified sample**, never the full corpus.

### AI pipeline (A4/A8, B-series)
`ingest → (transcribe | extract | fetch) → analyze → dna → ideas → studio`, server-side via Inngest.
- **Model tiering** (constants from `lib/ai/models.ts`): Haiku 4.5 (classify/tag/extract/chunk-score) · Sonnet 5 (drafts/variants) · Opus 4.8 (DNA synthesis + final polish).
- **Prompt caching** on the stable prefix (system + Content DNA + guardrails); **Batch API (−50%)** for nightly idea generation/backfills.
- **Credits debited before each op** with a pre-flight estimate.
- **Injection-safe (A8.1):** source text as delimited *data*, structured JSON output, **no tools** in analysis calls; injection eval case.
- **SSRF-safe (A8.2):** https allowlist, post-DNS private-IP block, redirect re-validation, size cap, timeout; plus MIME sniff, size caps, quarantine bucket, short-expiry signed URLs, public/private Storage separation.
- **Dialect engine v1 (B2):** per-dialect prompt module + few-shot from the user's own vault (authenticity reviewer post-MVP).
- **DNA-match score (B3):** computable stylometry vector similarity vs the vault + versioned-rubric LLM judge + UI explanation; removed if it can't be made trustworthy.
- **Prompt registry (B4):** `prompts/` one file per prompt, explicit `version`, no inline strings; every generation logs `prompt_id`+`prompt_version`; golden-set eval gates CI.

### Payments (A5) — MVP scope
`PaymentProvider` interface in `lib/payments/` (`createCheckout`, `createPortalSession`, `syncSubscription`, `handleWebhook`); no provider SDK imported outside `lib/payments/`. MVP ships **only the interface + empty `paddle`/`stripe` adapters + `credit_ledger`**. Concierge billing = manual bank transfer + PDF (off-code). Paddle (MoR, carries KSA 15% VAT) integration is post-MVP; Saudi gateway (mada/STC Pay/Tabby) a later fast-follow.

### i18n / RTL
`/ar` (RTL, IBM Plex Sans Arabic, Arabic-Indic numerals) and `/en` (LTR, Inter, Western numerals). Copy via `messages/{ar,en}.json`; prototype-screen ar copy extracted; **new-screen copy (voice interview, import, export) authored by founder**. CSS logical properties throughout; QA both locales at every breakpoint.

### Observability (A9) & Admin (A10)
Sentry (errors), PostHog (activation funnel `signup→onboarding_complete→first_source_ready→dna_v0→first_draft→first_export`, instrumented in M2), structured logs w/ `org_id`/`request_id`. Admin = Supabase dashboard + `docs/ADMIN_RUNBOOK.md` (no UI for MVP).
