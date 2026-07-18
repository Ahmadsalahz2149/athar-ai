import type { ContentDna } from "./prompts";

/** Deterministic, explainable scoring (RISKS #11 — computable composite, not a
 * fake number). Post Score = predicted engagement heuristics; DNA Match = overlap
 * of the draft with the voice profile. Both 0–100. */

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function postScore(hook: string, body: string): number {
  let s = 52;
  const h = (hook ?? "").trim();
  if (h.length >= 20 && h.length <= 120) s += 12;
  if (/[؟?]/.test(h)) s += 8; // a question hook pulls readers in
  if (/\d/.test(h)) s += 6; // numbers/specifics
  const words = (body ?? "").trim().split(/\s+/).filter(Boolean).length;
  if (words >= 40 && words <= 220) s += 14;
  else if (words < 20) s -= 16;
  else if (words > 320) s -= 6;
  if (/\n/.test(body ?? "")) s += 4; // structured / line breaks
  return clamp(s);
}

export function dnaMatch(text: string, dna: ContentDna | null): number {
  if (!dna) return 60;
  const hay = (text ?? "").toLowerCase();
  const terms = [
    ...(dna.tone_traits ?? []),
    ...(dna.hook_patterns ?? []),
    ...(dna.dos ?? []),
    dna.dialect,
    dna.audience,
  ]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase());
  if (!terms.length) return 60;
  let hit = 0;
  for (const term of terms) {
    const words = term.split(/\s+/).filter((w) => w.length > 2);
    if (words.some((w) => hay.includes(w))) hit++;
  }
  return clamp(42 + (hit / terms.length) * 55);
}

/** Explain a Post Score as named contributors (for "why this score?"). Each item
 * is a human-readable factor + whether it currently helps or hurts. */
export function scoreBreakdown(hook: string, body: string): { key: string; ok: boolean }[] {
  const h = (hook ?? "").trim();
  const words = (body ?? "").trim().split(/\s+/).filter(Boolean).length;
  return [
    { key: "hookLength", ok: h.length >= 20 && h.length <= 120 },
    { key: "question", ok: /[؟?]/.test(h) },
    { key: "number", ok: /\d/.test(h) },
    { key: "bodyLength", ok: words >= 40 && words <= 220 },
    { key: "structure", ok: /\n/.test(body ?? "") },
  ];
}

/** A light score for an idea title (used to rank Ideas Bank cards). */
export function ideaScore(title: string): number {
  let s = 55;
  const t = (title ?? "").trim();
  if (t.length >= 12 && t.length <= 90) s += 12;
  if (/[؟?]/.test(t)) s += 8;
  if (/\d/.test(t)) s += 6;
  return clamp(s);
}
