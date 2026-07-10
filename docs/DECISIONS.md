# ADRs (v4)

Each: context · options · decision · consequences.

**ADR-000 Phase −1 first.** *Context:* the plan put 63 dev-days ahead of any paying signal. *Decision:* **Wizard-of-Oz concierge for 2 agencies (text-only, manual prompts) before any product; a paying agency gates all of M0+.** *Consequences:* WTP is tested in ~1 week for 0 dev-days; if it fails, no code is written.

**ADR-001 Billing: concierge-first, Paddle deferred.** *Context:* MVP sells to ~5 agencies by manual invoice; Paddle needs a live site + legal pages + review latency and isn't required to hand-invoice 5 customers. *Decision:* **No self-serve billing in MVP.** Keep `PaymentProvider` interface (empty adapters) + `credit_ledger` (cost control) + Terms/Privacy/refund. **Paddle (MoR, carries KSA 15% VAT) + Stripe stub build *after* Design Partners validate WTP.** *Consequences:* the longest external dependency is removed from the critical path; billing is a bank transfer + PDF until validated.

**ADR-002 Transcription** — decided by the M0.5 bake-off on 10 real samples (WER/CER + dialect preservation + latency + $/hr → `EVAL_TRANSCRIPTION.md`); adapter in `lib/ai/transcription.ts`; **not on the Phase −1 path** (text-only). *Consequences:* provider swappable via env; evidence-based (ElevenLabs Scribe is a strong candidate the founder already has).

**ADR-003 Retrieval** — pgvector + Arabic semantic chunking (overlap, page/timestamp citations) + hybrid (vector + FTS/trigram); DNA reads a stratified sample; lexical mechanism finalized in M3. *Consequences:* bounded near-linear cost; citations; more M3 build than naive stuffing.

**ADR-004 Model tiering** — Haiku 4.5 classify/extract · Sonnet 5 drafts/variants · Opus 4.8 DNA synthesis + polish; prompt caching on the stable prefix; Batch API for nightly bulk; **all model IDs centralized in `lib/ai/models.ts`** (fix). *Consequences:* per-op cost predictable and low; plans priced in credits, not files; no scattered model names.

**ADR-005 Tenancy enforcement** — Drizzle's pooled service credential bypasses RLS, so "RLS protects users" is an illusion. *Decision:* **mandatory `db.forOrg()` façade + lint rule + RLS backstop**, validated by a **CI tenancy test** (2-brand org). *Consequences:* one code path for tenant data; the lint rule + test are load-bearing and must never be disabled.

**ADR-006 Framework** — **Next.js App Router + TS** (one codebase, locale routing, route handlers/server actions, middleware, Vercel). *Consequences:* fastest path; the client-heavy prototype maps to server components + islands.

**ADR-007 Cold start** — TTFV must be <5 min. *Decision:* **DNA v0 from a 10-question voice interview OR pasted posts / a public URL** — no upload required — shipped in the MVP. *Consequences:* first draft reachable in minutes; extra M2 build, but the largest de-risking lever.

**ADR-008 Embedding model (C4).** *Context:* changing the embedding model later forces a full re-embed. *Options:* pin by price (rejected) · **pin by an Arabic recall@5 eval**. *Decision:* M0.5 runs 20 Arabic queries × a 3-source corpus, recall@5 across ≥2 models (`EVAL_RETRIEVAL.md`); `vector(N)` pinned only after. *Consequences:* a one-time eval buys the right dimension and avoids a costly re-embed.

**ADR-009 Media retention (fix).** *Context:* deleting originals kills click-a-quote-to-hear-the-moment; keeping raw originals inflates COGS to ~$20/brand/mo. *Decision:* **transcode to 24 kbps mono Opus (~20 MB / 2-hr podcast), keep permanently, delete the original.** *Consequences:* ~$6 COGS retained *and* the audio-citation feature survives (chunks cite Opus timestamps).

**ADR-010 Contractor acceptance (fix).** *Decision:* **the acceptance harness (CI tenancy test, prompt-injection eval, SSRF eval, credit-math unit tests) is founder-authored and exists before any commodity work is delegated; acceptance = CI green, never code-judgment.** *Consequences:* safe delegation of the ~43 commodity dev-days.
