# Eval — Arabic retrieval / embedding model (M0.5, ADR-008, C4)

> **Status: NOT STARTED.** Pins `vector(N)` by evidence, not price. Changing the model later forces a full re-embed (RISKS #5).

## Corpus & queries
- 3 real Arabic sources, chunked (Arabic-aware semantic/paragraph chunking with overlap — never naive whitespace split).
- 20 Arabic queries with known-relevant chunks (label the ground truth).

## Method
Embed the corpus with each candidate model; run the 20 queries; measure **recall@5**. Also sanity-check hybrid (vector + Postgres FTS/trigram) vs vector-only.

## Candidates (≥2)
| Model | Dim (N) | Batch discount | recall@5 | Notes |
|---|---|---|---|---|
| Voyage-4-lite ($0.02/M) | | −33% | | |
| OpenAI text-embedding-3-small ($0.02/M) | | −50% batch | | |
| (optional) voyage-4 / 3-large | | | | |

## Decision (ADR-008)
- **Chosen model + `vector(N)`:** _____
- **Lexical mechanism for hybrid:** ☐ Postgres FTS (Arabic config) ☐ trigram/BM25 — chosen: _____
- **Rationale:** highest recall@5 on Arabic wins; price is a tiebreak only.
