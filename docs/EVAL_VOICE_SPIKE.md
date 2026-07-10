# Eval — Voice Spike (Phase −1, days 1–2)

> **Status: NOT STARTED.** Throwaway ~50-line script, no repo. Records whether Claude can write convincingly in a specific person's Arabic voice from their own posts.

## Inputs
- 5 real posts (founder or a client), pasted text.
- 1 transcript (pasted text; no audio — transcription is out of scope here).

## Method
1. Hand-write a **DNA-extraction prompt** (voice traits, register, hook patterns, MSA↔dialect ratio) → run on the 5 posts + transcript.
2. Hand-write a **draft prompt** (given the DNA + a topic) → generate 5 drafts.
3. Iterate both prompts until the drafts feel on-voice.
4. **Blind test** to 3 Gulf agency owners (see `PHASE_MINUS_1.md`).

## Results (fill in)
- Iterations to acceptable: ___
- Blind verdicts: ___ / 3 "yes" (gate ≥ 2)
- **Surviving prompts (verbatim) — these feed M4:**
  - DNA-extraction prompt: _____
  - Draft prompt: _____
- Failure notes / where it broke down: _____
