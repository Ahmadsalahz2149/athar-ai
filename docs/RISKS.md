# Risks · mitigation · owner (v4)

1. **Willingness-to-pay unproven** (biggest risk now that billing is cut) → **Phase −1 GATE** (2 agencies, text-only concierge, ask for $200/mo) before any build; 0 pay → STOP. *Owner: founder.*
2. **Voice/dialect fails** (Whisper MSA-ifies; DNA built on words never said) → Phase −1 day-1–2 voice-spike blind test + M0.5 transcription bake-off + dialect module; authenticity reviewer post-MVP. *Owner: founder (samples) + eng.*
3. **Solo capacity** (at N=1 → ~20-month runway) → calendar table forces the number; contract the ~43 commodity dev-days (~$8k–16k) to parallelize (~3.5 mo at N=2) — **only after the acceptance harness exists.** *Owner: founder.*
4. **Contractor code quality** → **founder-authored acceptance harness (CI tenancy test + injection eval + SSRF eval + credit-math tests) must exist before delegation; acceptance is CI-green, never judgment** (ADR-010). *Owner: founder + eng.*
5. **Embedding model change later = full re-embed** (C4) → ADR-008 pins `vector(N)` on evidence up front. *Owner: eng.*
6. **Tenant data leak** (agency = multi-client) → façade + lint + RLS backstop + CI tenancy test. *Owner: eng.*
7. **Prompt injection via uploaded docs** → delimited data + structured output + no tools in analysis + injection eval case. *Owner: eng.*
8. **SSRF via URL ingestion** → https allowlist + post-DNS private-IP block + redirect re-validation + size cap + timeout + SSRF eval case. *Owner: eng.*
9. **Negative unit economics** (media product; storage/egress dominate) → media = 24 kbps Opus transcode (ADR-009) + credit-ceiling gate (`UNIT_ECONOMICS.md`). *Owner: eng + founder.*
10. **Free-tier abuse** (voice interview costs money on an anon signup from second one) → email verification + hard cap + velocity limits, or no free AI. *Owner: eng.*
11. **Fake DNA-match score** erodes trust in week one → composite computable + explained score, or removed. *Owner: eng.*
12. **Data governance for agency client content** → **published data-retention policy + explicit "we do not train on your content" statement + a DPA, due before the first Design Partner signs.** *Owner: founder.*
13. **Design-Partner recruitment latency** (a day-1 lead-time item) → the Phase −1 agencies *are* the first partners; keep recruiting from day 1. *Owner: founder.*
14. **Secret leakage** → `.env*` gitignored on the first commit + pre-commit secret scan + Vercel-only keys; never paste keys in chat. *Owner: eng.*
