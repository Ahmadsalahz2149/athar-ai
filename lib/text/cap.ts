/**
 * Length caps for stored, user-editable text.
 *
 * Array *counts* were already capped in these structures; the strings inside
 * them were not. That mattered most for the Content DNA, which is injected into
 * every generation prompt — an unbounded DNA is an unbounded prompt, billed to
 * us on every single generation, and stored as unbounded JSONB besides.
 *
 * The limits are generous for anything a person would actually write and small
 * enough that nothing here can become a payload. Silent truncation is the right
 * behaviour: these are best-effort normalizers that must never throw, and a
 * user who pastes an essay into a one-line field should get their field saved,
 * not an error.
 */

/** A string, coerced and truncated. Non-strings become "". */
export function capStr(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/**
 * A list of non-empty strings, bounded in both directions: how many, how long.
 *
 * Non-strings are DROPPED, not coerced. A number in a list of keywords is bad
 * data, and `String(5)` turns it into a plausible-looking `"5"` that then
 * travels into a search query or a prompt. The distribution normalizer already
 * worked this way and a test caught the difference when this helper was first
 * written the other way round.
 */
export function capList(v: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.slice(0, maxChars))
    .filter((x) => x.trim().length > 0)
    .slice(0, maxItems);
}

/** Caps for the Content DNA. It rides along in every generation prompt, so
 * these are the tightest. */
export const DNA_CAPS = {
  summary: 1500,
  dialect: 120,
  audience: 800,
  explanationStyle: 500,
  awareness: 400,
  /** tone_traits, dos, donts, hook_patterns, cta_patterns, cares_about. */
  listItems: 12,
  listChars: 300,
} as const;

/** Caps for the brand profile, which also feeds prompts. */
export const PROFILE_CAPS = {
  productionNotes: 2000,
  teamSize: 80,
  descShort: 400,
  descDetailed: 2500,
  descTechnical: 2500,
  constraintItems: 20,
  constraintChars: 300,
  qaItems: 20,
  qaQuestion: 300,
  qaAnswer: 1500,
} as const;

/** Caps for a source analysis. Model output rather than typed input, so roomier
 * — but still bounded, because "the model returned something enormous" is a
 * failure mode too. */
export const ANALYSIS_CAPS = {
  summary: 4000,
  listItems: 30,
  listChars: 800,
} as const;

/** Caps for the distribution kit (AI-generated audience + group queries). */
export const KIT_CAPS = {
  summary: 2000,
  demographics: 1200,
  query: 200,
  platform: 40,
  /** segments, interests, painPoints, wateringHoles. */
  listChars: 300,
} as const;
