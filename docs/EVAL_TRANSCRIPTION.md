# Eval — Transcription bake-off (M0.5, ADR-002)

> **Status: NOT STARTED.** Gated on the founder's 10 dialect audio samples. Not on the Phase −1 path (text-only).

## Samples (owner: founder)
Najdi · Hijazi · Khaleeji · Egyptian · MSA · + 2 code-switching (Arabic+English). 10 total.

## Candidates (≥3)
ElevenLabs Scribe (batch $0.22/hr) · a Gemini audio model · Whisper large-v3 (+ dialect prompt) · (optional) Deepgram.

## Metrics
| Provider | WER | CER | Dialect preserved (keeps عامية vs MSA-ifies) | Diarization (if relevant) | Latency | $/audio-hr |
|---|---|---|---|---|---|---|
| ElevenLabs Scribe | | | | | | $0.22 |
| Gemini audio | | | | | | |
| Whisper large-v3 +prompt | | | | | | ~$0.36 |
| Deepgram (opt) | | | | | | |

## Decision (ADR)
- **Chosen provider:** _____
- **Rationale:** _____ (dialect preservation weighted heavily; the product premise is authentic Arabic voice).
- Adapter: `lib/ai/transcription.ts`, swappable via env.
