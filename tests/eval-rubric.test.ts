import { describe, it, expect } from "vitest";
import { hasChinese, looksArabic, scoreDna, scoreDrafts } from "@/lib/eval/rubric";
import type { ContentDna } from "@/lib/ai/prompts";

// The eval rubric is deterministic and unit-tested for free — this is the part
// of the golden-set harness that gates CI without spending tokens (ADR-010).

const goodDna: ContentDna = {
  summary: "كاتب يشرح ريادة الأعمال بأسلوب مباشر ومحفّز.",
  dialect: "خليجي سعودي",
  tone_traits: ["مباشر", "محفّز", "عملي"],
  hook_patterns: ["سؤال مباشر", "قاعدة ذهبية"],
  audience: "رواد الأعمال الشباب",
  dos: ["استخدم أمثلة"],
  donts: ["لا تعقّد"],
  completion_pct: 60,
};

describe("language detectors", () => {
  it("flags Chinese/Japanese leakage", () => {
    expect(hasChinese("这是中文")).toBe(true);
    expect(hasChinese("كلام عربي فقط")).toBe(false);
    expect(hasChinese("English only")).toBe(false);
  });

  it("recognizes majority-Arabic text", () => {
    expect(looksArabic("هذا نص عربي")).toBe(true);
    expect(looksArabic("this is english")).toBe(false);
    expect(looksArabic("")).toBe(false);
    expect(looksArabic("رواد الأعمال 2026 startup")).toBe(true); // majority Arabic letters
  });
});

describe("scoreDna", () => {
  it("passes a good DNA and matches the expected dialect", () => {
    const s = scoreDna(goodDna, { dialectKeywords: ["خليج", "سعود"], minCompletion: 30 });
    expect(s.pass).toBe(true);
    expect(s.score).toBe(1);
  });

  it("fails on Chinese leakage in the summary (critical)", () => {
    const s = scoreDna({ ...goodDna, summary: "这是中文摘要" });
    expect(s.pass).toBe(false);
  });

  it("fails when tone traits are too few (critical)", () => {
    const s = scoreDna({ ...goodDna, tone_traits: ["مباشر"] });
    expect(s.pass).toBe(false);
  });

  it("does not fail the gate on a missed non-critical dialect keyword alone", () => {
    const s = scoreDna(goodDna, { dialectKeywords: ["مصري"] }); // wrong keyword => that one check fails
    expect(s.checks.find((c) => c.name === "dialect_match")?.pass).toBe(false);
    expect(s.pass).toBe(true); // still >= 0.8 and all critical pass
  });
});

describe("scoreDrafts", () => {
  const good = [
    { hook: "ابدأ صغيرًا", body: "ثلاث خطوات عملية تساعدك على إطلاق مشروعك بأقل تكلفة ممكنة اليوم." },
    { hook: "لا تنتظر", body: "أهم درس: انزل بالمنتج ناقصًا ودع السوق يعلّمك الباقي بسرعة وثقة." },
  ];

  it("passes clean Arabic drafts", () => {
    expect(scoreDrafts(good, { minCount: 2 }).pass).toBe(true);
  });

  it("fails when a draft leaks Chinese (critical)", () => {
    const bad = [good[0], { hook: "试试", body: "这是中文内容不应该出现在这里绝对不行" }];
    expect(scoreDrafts(bad, { minCount: 2 }).pass).toBe(false);
  });

  it("fails when fewer drafts than required (critical)", () => {
    expect(scoreDrafts([good[0]], { minCount: 2 }).pass).toBe(false);
  });
});
