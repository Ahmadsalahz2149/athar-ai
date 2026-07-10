/**
 * Single source of truth for Claude model IDs (ADR-004).
 * Never hardcode a model name at a call site — import from here.
 * Verified against the claude-api reference (July 2026).
 */
export const MODELS = {
  /** DNA synthesis + final polish. $5/$25 per MTok, 1M ctx, no long-context premium. */
  OPUS: "claude-opus-4-8",
  /** Workhorse: drafts + variants. $3/$15 per MTok ($2/$10 intro to 2026-08-31). */
  SONNET: "claude-sonnet-5",
  /** Cheap/fast: classification, tagging, extraction, chunk scoring. $1/$5 per MTok. */
  HAIKU: "claude-haiku-4-5",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

/** Task → model tier mapping (ADR-004). */
export const MODEL_FOR = {
  classify: MODELS.HAIKU,
  extract: MODELS.HAIKU,
  chunkScore: MODELS.HAIKU,
  draft: MODELS.SONNET,
  variants: MODELS.SONNET,
  analyze: MODELS.SONNET,
  dnaSynthesis: MODELS.OPUS,
  polish: MODELS.OPUS,
} as const;

export type Task = keyof typeof MODEL_FOR;
