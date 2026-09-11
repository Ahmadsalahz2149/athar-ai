import type { ContentDna, FileAnalysis } from "./prompts";
import { capList, capStr, ANALYSIS_CAPS, DNA_CAPS } from "@/lib/text/cap";

export type Draft = { hook: string; body: string };

/**
 * Coerce any model output into a well-formed DNA — missing fields never crash
 * the UI, and no field is unbounded.
 *
 * The bounds are not cosmetic. This DNA is injected into every generation
 * prompt, and the edit screen writes straight through here, so an unbounded
 * field is an unbounded prompt on every generation from then on — billed to us,
 * and stored as unbounded JSONB besides.
 */
export function normalizeDna(raw: unknown): ContentDna {
  const o = (raw ?? {}) as Record<string, unknown>;
  const arr = (v: unknown) => capList(v, DNA_CAPS.listItems, DNA_CAPS.listChars);
  const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : dflt;
  };
  const pct = Number(o.completion_pct);
  const p = (o.pillars ?? {}) as Record<string, unknown>;
  const pillar = (k: string) => clampInt(p[k], 0, 100, 0);
  const pillars = {
    educational: pillar("educational"),
    story: pillar("story"),
    proof: pillar("proof"),
    soft_sell: pillar("soft_sell"),
    thought_leadership: pillar("thought_leadership"),
    engagement: pillar("engagement"),
  };
  // Fall back to a sensible default mix if the model returned all zeros (old DNA).
  const sum = Object.values(pillars).reduce((a, b) => a + b, 0);
  if (sum === 0) Object.assign(pillars, { educational: 35, story: 20, proof: 15, soft_sell: 12, thought_leadership: 10, engagement: 8 });

  return {
    summary: capStr(o.summary, DNA_CAPS.summary),
    dialect: capStr(o.dialect, DNA_CAPS.dialect),
    tone_traits: arr(o.tone_traits),
    hook_patterns: arr(o.hook_patterns),
    audience: capStr(o.audience, DNA_CAPS.audience),
    dos: arr(o.dos),
    donts: arr(o.donts),
    explanation_style: capStr(o.explanation_style, DNA_CAPS.explanationStyle),
    sentence_length: clampInt(o.sentence_length, 1, 3, 2),
    boldness: clampInt(o.boldness, 1, 3, 2),
    awareness: capStr(o.awareness, DNA_CAPS.awareness),
    cares_about: arr(o.cares_about),
    cta_patterns: arr(o.cta_patterns),
    pillars,
    completion_pct: Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.round(pct))) : 0,
  };
}

const strArr = (v: unknown) => capList(v, ANALYSIS_CAPS.listItems, ANALYSIS_CAPS.listChars);

export function normalizeAnalysis(raw: unknown): FileAnalysis {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    summary: capStr(o.summary, ANALYSIS_CAPS.summary),
    key_ideas: strArr(o.key_ideas),
    quotes: strArr(o.quotes),
    audience_problems: strArr(o.audience_problems),
    content_opportunities: strArr(o.content_opportunities),
  };
}

const IDEA_CATS = ["educational", "story", "list", "guide", "analytical", "contrarian"];
export function normalizeIdeas(raw: unknown): { title: string; angle: string; category: string }[] {
  const o = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(o.ideas) ? o.ideas : [];
  return list
    .map((d) => {
      const x = (d ?? {}) as Record<string, unknown>;
      const cat = typeof x.category === "string" && IDEA_CATS.includes(x.category) ? x.category : "educational";
      return {
        title: typeof x.title === "string" ? x.title : "",
        angle: typeof x.angle === "string" ? x.angle : "",
        category: cat,
      };
    })
    .filter((i) => i.title.trim());
}

export function normalizeDrafts(raw: unknown): Draft[] {
  const o = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(o.drafts) ? o.drafts : [];
  return list
    .map((d) => {
      const x = (d ?? {}) as Record<string, unknown>;
      return {
        hook: typeof x.hook === "string" ? x.hook : "",
        body: typeof x.body === "string" ? x.body : "",
      };
    })
    .filter((d) => d.hook.trim() || d.body.trim());
}
