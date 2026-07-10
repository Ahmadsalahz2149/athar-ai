/** Deterministic scoring for the golden-set eval (ADR: prompt registry + eval).
 * Pure — no API, no server-only — so the rubric itself is unit-tested for free
 * and can gate CI, while eval/run.ts uses it against real model output. */

import type { ContentDna } from "@/lib/ai/prompts";
import type { Draft } from "@/lib/ai/normalize";

export type Check = { name: string; pass: boolean; critical: boolean };
export type Score = { checks: Check[]; score: number; pass: boolean };

/** CJK ideographs + kana — catches Chinese/Japanese leakage (the MiniMax failure). */
export function hasChinese(s: string): boolean {
  return /[぀-ヿ㐀-䶿一-鿿]/.test(s || "");
}

/** True when the majority of letters are Arabic (ignores digits/punctuation/emoji). */
export function looksArabic(s: string): boolean {
  const t = (s || "").trim();
  if (!t) return false;
  const arabic = (t.match(/[؀-ۿݐ-ݿ]/g) || []).length;
  const letters = (t.match(/[A-Za-z؀-ۿݐ-ݿ]/g) || []).length;
  if (letters === 0) return false;
  return arabic / letters >= 0.5;
}

function roll(checks: Check[]): Score {
  const passed = checks.filter((c) => c.pass).length;
  const score = checks.length ? passed / checks.length : 0;
  const criticalOk = checks.every((c) => !c.critical || c.pass);
  return { checks, score, pass: criticalOk && score >= 0.8 };
}

export type DnaExpect = {
  /** dialect must contain at least one of these substrings (any match passes). */
  dialectKeywords?: string[];
  minCompletion?: number;
};

export function scoreDna(dna: ContentDna, expect: DnaExpect = {}): Score {
  const dialect = (dna.dialect || "").trim();
  const summary = (dna.summary || "").trim();
  const kw = expect.dialectKeywords ?? [];
  const checks: Check[] = [
    { name: "dialect_present", pass: dialect.length > 0, critical: true },
    {
      name: "dialect_match",
      pass: kw.length === 0 ? true : kw.some((k) => dialect.includes(k)),
      critical: false,
    },
    { name: "summary_arabic", pass: looksArabic(summary) && !hasChinese(summary), critical: true },
    { name: "dialect_no_chinese", pass: !hasChinese(dialect), critical: true },
    { name: "tone_traits>=2", pass: (dna.tone_traits?.length ?? 0) >= 2, critical: true },
    { name: "hook_patterns>=1", pass: (dna.hook_patterns?.length ?? 0) >= 1, critical: false },
    { name: "audience_present", pass: (dna.audience || "").trim().length > 0, critical: false },
    {
      name: "completion>=min",
      pass: (dna.completion_pct ?? 0) >= (expect.minCompletion ?? 1),
      critical: false,
    },
  ];
  return roll(checks);
}

export type DraftExpect = {
  minCount?: number;
  minLen?: number;
  maxLen?: number;
};

export function scoreDrafts(drafts: Draft[], expect: DraftExpect = {}): Score {
  const minLen = expect.minLen ?? 40;
  const maxLen = expect.maxLen ?? 3000;
  const bodies = drafts.map((d) => (d.body || "").trim());
  const hooks = drafts.map((d) => (d.hook || "").trim());
  const checks: Check[] = [
    { name: "count>=min", pass: drafts.length >= (expect.minCount ?? 1), critical: true },
    {
      name: "all_arabic",
      pass: bodies.length > 0 && bodies.every((b) => looksArabic(b) && !hasChinese(b)),
      critical: true,
    },
    { name: "no_chinese_hooks", pass: hooks.every((h) => !hasChinese(h)), critical: true },
    { name: "all_have_hook", pass: hooks.length > 0 && hooks.every((h) => h.length > 0), critical: false },
    {
      name: "length_in_range",
      pass: bodies.length > 0 && bodies.every((b) => b.length >= minLen && b.length <= maxLen),
      critical: false,
    },
  ];
  return roll(checks);
}
