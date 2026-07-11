import type { ContentDna, FileAnalysis } from "./prompts";

export type Draft = { hook: string; body: string };

/** Coerce any model output into a well-formed DNA — missing fields never crash the UI. */
export function normalizeDna(raw: unknown): ContentDna {
  const o = (raw ?? {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
  const pct = Number(o.completion_pct);
  return {
    summary: typeof o.summary === "string" ? o.summary : "",
    dialect: typeof o.dialect === "string" ? o.dialect : "",
    tone_traits: arr(o.tone_traits),
    hook_patterns: arr(o.hook_patterns),
    audience: typeof o.audience === "string" ? o.audience : "",
    dos: arr(o.dos),
    donts: arr(o.donts),
    completion_pct: Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.round(pct))) : 0,
  };
}

const strArr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);

export function normalizeAnalysis(raw: unknown): FileAnalysis {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    summary: typeof o.summary === "string" ? o.summary : "",
    key_ideas: strArr(o.key_ideas),
    quotes: strArr(o.quotes),
    audience_problems: strArr(o.audience_problems),
    content_opportunities: strArr(o.content_opportunities),
  };
}

export function normalizeIdeas(raw: unknown): { title: string; angle: string }[] {
  const o = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(o.ideas) ? o.ideas : [];
  return list
    .map((d) => {
      const x = (d ?? {}) as Record<string, unknown>;
      return {
        title: typeof x.title === "string" ? x.title : "",
        angle: typeof x.angle === "string" ? x.angle : "",
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
