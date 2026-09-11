import { describe, it, expect } from "vitest";
import { capList, capStr, DNA_CAPS, PROFILE_CAPS } from "@/lib/text/cap";
import { normalizeDna, normalizeAnalysis } from "@/lib/ai/normalize";
import { normalizeProfile } from "@/lib/brand/profile";
import { normalizeKit } from "@/lib/distribution/types";
import { normalizeLinkPage } from "@/lib/link/types";

/**
 * These structures are stored as JSONB and — for the DNA and the brand profile
 * — injected into every generation prompt. Array counts were capped; the
 * strings inside them were not, so one oversized edit inflated the token bill
 * on every generation from then on. These tests are the bound.
 */
const huge = "ا".repeat(2_000_000);
const hugeList = Array.from({ length: 5_000 }, () => huge);

describe("cap helpers", () => {
  it("truncates a string and coerces a non-string to empty", () => {
    expect(capStr(huge, 10)).toHaveLength(10);
    expect(capStr("short", 100)).toBe("short");
    expect(capStr(null, 10)).toBe("");
    expect(capStr(42, 10)).toBe("");
  });

  it("bounds a list in both directions and drops blanks", () => {
    const out = capList(["a", "  ", "b", huge], 3, 5);
    expect(out).toHaveLength(3);
    expect(out.every((x) => x.length <= 5)).toBe(true);
    expect(out).not.toContain("  ");
  });

  // Coercing would turn a stray number into a plausible-looking "5" that then
  // travels into a search query or a generation prompt.
  it("drops non-strings instead of stringifying them", () => {
    expect(capList(["k", 5, null, {}, "v"], 10, 50)).toEqual(["k", "v"]);
  });
});

describe("normalizeDna", () => {
  // The DNA rides in EVERY generation prompt, so this is the one that costs
  // money when it is unbounded.
  it("bounds every field a user can edit", () => {
    const dna = normalizeDna({
      summary: huge, dialect: huge, audience: huge, explanation_style: huge, awareness: huge,
      tone_traits: hugeList, dos: hugeList, donts: hugeList,
      hook_patterns: hugeList, cta_patterns: hugeList, cares_about: hugeList,
    });
    expect(dna.summary).toHaveLength(DNA_CAPS.summary);
    expect(dna.dialect).toHaveLength(DNA_CAPS.dialect);
    expect(dna.audience).toHaveLength(DNA_CAPS.audience);
    expect(dna.explanation_style).toHaveLength(DNA_CAPS.explanationStyle);
    expect(dna.awareness).toHaveLength(DNA_CAPS.awareness);
    for (const list of [dna.tone_traits, dna.dos, dna.donts, dna.hook_patterns, dna.cta_patterns, dna.cares_about]) {
      expect(list.length).toBeLessThanOrEqual(DNA_CAPS.listItems);
      expect(list.every((x) => x.length <= DNA_CAPS.listChars)).toBe(true);
    }
  });

  // The number that actually matters: what a whole DNA can add to a prompt.
  it("keeps the WHOLE serialized DNA well under any model's context", () => {
    const worst = normalizeDna({
      summary: huge, dialect: huge, audience: huge, explanation_style: huge, awareness: huge,
      tone_traits: hugeList, dos: hugeList, donts: hugeList,
      hook_patterns: hugeList, cta_patterns: hugeList, cares_about: hugeList,
    });
    const bytes = JSON.stringify(worst).length;
    expect(bytes).toBeLessThan(30_000); // ~8k tokens, bounded and affordable
  });

  it("still passes ordinary content through untouched", () => {
    const dna = normalizeDna({ summary: "صوت واضح ومباشر", tone_traits: ["ودّي", "عملي"], dialect: "خليجي" });
    expect(dna.summary).toBe("صوت واضح ومباشر");
    expect(dna.tone_traits).toEqual(["ودّي", "عملي"]);
    expect(dna.dialect).toBe("خليجي");
  });
});

describe("the other stored structures", () => {
  it("bounds the brand profile, which also feeds prompts", () => {
    const p = normalizeProfile({
      constraints: hugeList, productionNotes: huge, teamSize: huge,
      descShort: huge, descDetailed: huge, descTechnical: huge,
      qa: Array.from({ length: 500 }, () => ({ q: huge, a: huge })),
    });
    expect(p.productionNotes).toHaveLength(PROFILE_CAPS.productionNotes);
    expect(p.teamSize).toHaveLength(PROFILE_CAPS.teamSize);
    expect(p.descShort).toHaveLength(PROFILE_CAPS.descShort);
    expect(p.constraints.length).toBeLessThanOrEqual(PROFILE_CAPS.constraintItems);
    expect(p.qa.length).toBeLessThanOrEqual(PROFILE_CAPS.qaItems);
    expect(p.qa.every((x) => x.q.length <= PROFILE_CAPS.qaQuestion && x.a.length <= PROFILE_CAPS.qaAnswer)).toBe(true);
    expect(JSON.stringify(p).length).toBeLessThan(80_000);
  });

  it("bounds a source analysis, in case the model returns something enormous", () => {
    const a = normalizeAnalysis({ summary: huge, key_ideas: hugeList, quotes: hugeList, audience_problems: hugeList, content_opportunities: hugeList });
    expect(JSON.stringify(a).length).toBeLessThan(120_000);
  });

  it("bounds the distribution kit and the link page", () => {
    // Populate the string ARRAYS too — reviewing the first version of this fix
    // showed they were still uncapped, and the test passed only because it had
    // not filled them in.
    const k = normalizeKit({
      audience: {
        summary: huge, demographics: huge,
        segments: hugeList, interests: hugeList, painPoints: hugeList, wateringHoles: hugeList,
      },
      queries: Array.from({ length: 500 }, () => ({ platform: huge, query: huge })),
    });
    expect(k.audience.segments.every((x) => x.length <= 300)).toBe(true);
    expect(k.audience.wateringHoles.every((x) => x.length <= 300)).toBe(true);
    expect(JSON.stringify(k).length).toBeLessThan(120_000);
    const l = normalizeLinkPage({ headline: huge, bio: huge, links: Array.from({ length: 500 }, () => ({ label: huge, url: huge })) });
    expect(JSON.stringify(l).length).toBeLessThan(20_000);
  });
});
