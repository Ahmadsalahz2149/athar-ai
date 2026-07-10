# Unit economics (v4)

**Verified rates (July 2026, numbers founder-confirmed).** Claude/MTok: **Opus 4.8 $5/$25**, **Sonnet 5 $3/$15** ($2/$10 intro to 2026-08-31), **Haiku 4.5 $1/$5**; cache read 10%, write ×1.25; Batch −50%; Opus 4.8 no long-context premium — [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing). Transcription: **ElevenLabs Scribe batch $0.22/audio-hr** — [ElevenLabs](https://elevenlabs.io/pricing/api). Embeddings **$0.02/MTok** (Voyage-4-lite / OpenAI text-embedding-3-small) — [Voyage](https://docs.voyageai.com/docs/pricing). Payments (post-MVP): Paddle 5%+$0.50 — [Paddle](https://www.paddle.com/pricing).

**Assumptions:** 1 audio-hour ≈ 9k words ≈ 12k transcript tokens. Retrieval keeps Claude inputs bounded (top-K chunks), so per-op input ≈ 6–12k tokens, not the full corpus.

| Operation | Model / service | Rough tokens | Est. cost |
|---|---|---|---|
| Transcribe 1 podcast-hour | Scribe batch | — | **$0.22** |
| Embed 1 source (~12k tok) | embeddings $0.02/M | 12k | **~$0.0002** |
| Analyze 1 source (summary+ideas+quotes) | Sonnet 5 | ~8k in / 2k out | **~$0.05** |
| Idea generation (1 source) | Sonnet 5 (Batch nightly −50%) | ~6k in / 2k out | **~$0.02–0.05** |
| DNA rebuild (stratified) | Opus 4.8, cached prefix | ~30k in / 4k out | **~$0.15–0.25** |
| Studio draft (+variants) | Sonnet 5, cached DNA prefix | ~5k in (mostly cached) / 1.5k out | **~$0.03–0.05** |

**Infra COGS + media policy (fix).** Media product → storage dominates. **Policy (ADR-009): keep a 24 kbps mono Opus transcode (~20 MB / 2-hr podcast) permanently, delete the original.** Storage stays pennies/brand/mo → **all-in ≈ $6/brand/mo**, and click-a-quote-to-hear survives (chunks cite Opus timestamps). Inngest/Vercel/Sentry/PostHog: ~$0–5/brand/mo blended at MVP scale + ~$100–300/mo platform baseline independent of brand count. (Retaining raw originals instead would add ~$8–14/brand/mo → ~$18–20; rejected.)

**Margin gate (ceiling, not average).** `max COGS a plan permits = credit_allowance × worst-case_cost_per_credit` (worst case = a long podcast: transcribe + long analysis + DNA rebuild). **Plan price ≥ 3 × that CEILING + infra allocation** — not 3× an assumed 8-sources/month average. Size each credit to the worst-case op, cap credits/plan, then price ≥ 3× (credit_cap × worst-case unit cost) + infra allocation. **No price number is fixed until Design Partners.** Placeholder tiers: `Starter` / `Pro` / `Agency`; **plans priced in credits, not files.** If a tier's projected usage pushes COGS above its price, **the pricing changes, not the plan.**

**Free-tier abuse model.** The voice interview costs real money on an anonymous signup from second one. **Controls:** required email verification before any AI runs; a hard lifetime cap on free AI (e.g. 1 DNA v0 + N drafts); per-IP/per-email velocity limits; disposable-domain blocklist. **Default stance: no free AI without a verified email** (consider "no free AI at all" — free = read-only tour — if abuse appears).
