# Deliberately not building (pre-paying-signal / MVP) — with reasons (v4)

- **Anything in M0–M5, until Phase −1 produces a paying agency.** The paying gate precedes all product build.
- **Self-serve billing (Paddle adapter, webhooks, `webhook_events`, checkout, marketing/pricing page)** — 5 agencies are hand-invoiced (bank transfer + PDF); Paddle needs a live site + review latency and isn't required to invoice 5 customers. Deferred to **after Design Partners validate WTP.** *Kept: `PaymentProvider` interface (empty), `credit_ledger`, Terms/Privacy/refund.*
- **Calendar, Approvals, Analytics dashboards, standalone Ideas** — outside Ingest→Analysis→DNA→Studio→Export; Ideas folds into Studio.
- **Team seats/roles, brand switcher, public client-review links** — multi-brand *schema* ships day one (org→brands), but MVP UX is single-brand.
- **Real social publishing (LinkedIn/X/Instagram/TikTok OAuth) + real platform analytics** — partner review, paid API tiers, audits; long lead + high failure. MVP is **export-first** (clipboard + composer deep links + asset bundle); evaluate an aggregator before per-platform OAuth.
- **Fake analytics numbers** — never; labelled internal metrics or "Connect a platform".
- **Dialect-authenticity reviewer pass / full guardrail engine / admin UI** — MVP ships the lighter versions (module+few-shot / banned-list+one pass / runbook).
- **Saudi gateway (mada/STC Pay/Tabby), Stripe live path** — fast-follow / stub-only.
- **Raw original media retention and timestamp audio playback** — after successful processing the upload is deleted and only extracted text/transcript chunks are retained. A permanent low-bitrate audio derivative is not implemented yet.
- **Feedback→DNA compounding loop (B6)** — the moat; schema (`posts` + `metrics_daily` + `dna_versions`) is built to support it now, feature ships after MVP. **Architected in, not out.**
- **10/10 honesty (§7):** every dimension the *code* controls (security, data model, AI-quality gates, unit economics, i18n/RTL, a11y, reliability, tests) is an explicit acceptance criterion at 10/10. **Differentiation and commercial readiness cannot be 10/10 pre-launch** — paying customers decide them (Phase −1 → Design Partners); we won't gold-plate them or let that pursuit delay the MVP.
