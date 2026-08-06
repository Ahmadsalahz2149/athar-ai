import { describe, it, expect } from "vitest";
import { normalizeProfile, profileHasContent, EMPTY_PROFILE } from "@/lib/brand/profile";
import { normalizeKit, kitHasContent, groupSearchUrl, EMPTY_KIT } from "@/lib/distribution/types";
import { normalizePlan, planHasContent, monthKey } from "@/lib/plan/types";
import { daysInMonth, upcomingDays, WORLD_DAYS } from "@/lib/plan/worldDays";
import { normalizeLinkPage, normalizeHandle, safeUrl } from "@/lib/link/types";
import { buildAudienceMessage, buildPlanMessage, buildAssistantContext, buildBrandContext } from "@/lib/ai/prompts";

const DNA = {
  summary: "s", dialect: "مصري", tone_traits: ["واثق"], hook_patterns: [], audience: "مسوقون", dos: [], donts: [],
  explanation_style: "", sentence_length: 2, boldness: 2, awareness: "", cares_about: [], cta_patterns: [],
  pillars: { educational: 50, story: 10, proof: 10, soft_sell: 10, thought_leadership: 10, engagement: 10 }, completion_pct: 88,
} as never;

/* ---------- Brand profile (Phase 1) ---------- */
describe("normalizeProfile", () => {
  it("returns a safe empty profile for junk input", () => {
    expect(normalizeProfile(null)).toEqual(EMPTY_PROFILE);
    expect(normalizeProfile("x")).toEqual(EMPTY_PROFILE);
    expect(normalizeProfile({ constraints: "not-array", qa: 5 })).toEqual(EMPTY_PROFILE);
  });
  it("keeps valid fields and caps arrays + drops empty qa", () => {
    const p = normalizeProfile({ constraints: ["a", "", "b"], teamSize: "solo", qa: [{ q: "x", a: "y" }, { q: "", a: "" }] });
    expect(p.constraints).toEqual(["a", "b"]);
    expect(p.teamSize).toBe("solo");
    expect(p.qa).toEqual([{ q: "x", a: "y" }]);
  });
  it("profileHasContent reflects real content", () => {
    expect(profileHasContent(EMPTY_PROFILE)).toBe(false);
    expect(profileHasContent(normalizeProfile({ descShort: "hi" }))).toBe(true);
  });
});

/* ---------- Distribution kit (Phase 2) ---------- */
describe("normalizeKit + groupSearchUrl", () => {
  it("normalizes queries and filters bad ones", () => {
    const k = normalizeKit({ audience: { summary: "aud" }, keywords: ["k", 5], queries: [{ platform: "facebook", query: "q" }, { query: "" }] });
    expect(k.audience.summary).toBe("aud");
    expect(k.keywords).toEqual(["k"]);
    expect(k.queries).toEqual([{ platform: "facebook", query: "q" }]);
    expect(kitHasContent(k)).toBe(true);
    expect(kitHasContent(EMPTY_KIT)).toBe(false);
  });
  it("builds platform search URLs with encoded queries", () => {
    expect(groupSearchUrl("facebook", "تسويق رقمي")).toContain("facebook.com/search/groups");
    expect(groupSearchUrl("linkedin", "growth")).toContain("linkedin.com/search/results/groups");
    expect(groupSearchUrl("telegram", "x")).toContain("google.com/search");
    expect(groupSearchUrl("facebook", "a b")).toContain("a%20b");
  });
});

/* ---------- Monthly plan + world days (Phase 2) ---------- */
describe("normalizePlan + worldDays", () => {
  it("clamps day, defaults pillar/format, sorts by day, caps at 40", () => {
    const raw = { plan: [{ day: 99, title: "t2", pillar: "x", format: "y" }, { day: 3, title: "t1", pillar: "story", format: "reel" }], trends: ["tr", 7] };
    const p = normalizePlan(raw);
    expect(p.plan[0].day).toBe(3);
    expect(p.plan[1].day).toBe(31); // clamped
    expect(p.plan[1].pillar).toBe("educational"); // bad -> default
    expect(p.plan[1].format).toBe("post"); // bad -> default
    expect(p.trends).toEqual(["tr"]);
    expect(planHasContent(p)).toBe(true);
  });
  it("monthKey zero-pads", () => {
    expect(monthKey(2026, 8)).toBe("2026-08");
    expect(monthKey(2026, 12)).toBe("2026-12");
  });
  it("worldDays: daysInMonth sorted, upcomingDays wraps the year", () => {
    const dec = daysInMonth(12);
    expect(dec.length).toBeGreaterThan(0);
    expect(dec).toEqual([...dec].sort((a, b) => a.day - b.day));
    const up = upcomingDays(12, 20, 5); // late December → should wrap into January
    expect(up.length).toBe(5);
    expect(up.some((d) => d.month === 1)).toBe(true);
    expect(WORLD_DAYS.every((d) => d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= 31)).toBe(true);
  });
});

/* ---------- Link page (Phase 3 #17) ---------- */
describe("link page validation", () => {
  it("normalizeHandle slugs and enforces min length", () => {
    expect(normalizeHandle("Ahmad Salah!")).toBe("ahmadsalah");
    expect(normalizeHandle("ab")).toBe(""); // too short
    expect(normalizeHandle("my-brand_1")).toBe("my-brand_1");
    expect(normalizeHandle("A".repeat(50)).length).toBe(30); // capped
  });
  it("safeUrl adds https and preserves schemes", () => {
    expect(safeUrl("example.com")).toBe("https://example.com");
    expect(safeUrl("https://x.com")).toBe("https://x.com");
    expect(safeUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(safeUrl("")).toBe("");
  });
  it("normalizeLinkPage drops links missing label or url and caps at 15", () => {
    const lp = normalizeLinkPage({ headline: "H", links: [{ label: "a", url: "x.com" }, { label: "", url: "y" }, { label: "z" }] });
    expect(lp.headline).toBe("H");
    expect(lp.links).toEqual([{ label: "a", url: "x.com" }]);
  });
});

/* ---------- Prompt builders (Phase 2/3) ---------- */
describe("prompt builders inject brand + context", () => {
  it("buildAudienceMessage includes DNA and brand block", () => {
    const brand = buildBrandContext({ profile: normalizeProfile({ constraints: ["لا موسيقى"] }), products: [] });
    const msg = buildAudienceMessage({ dna: DNA, brand });
    expect(msg).toContain("<DNA>");
    expect(msg).toContain("<BRAND>");
    expect(msg).toContain("لا موسيقى");
  });
  it("buildPlanMessage carries month, count, occasions", () => {
    const msg = buildPlanMessage({ dna: DNA, monthName: "أغسطس ٢٠٢٦", daysInMonth: 31, count: 16, occasions: "12: يوم الشباب" });
    expect(msg).toContain("أغسطس ٢٠٢٦");
    expect(msg).toContain("16");
    expect(msg).toContain("<OCCASIONS>");
    expect(msg).toContain("يوم الشباب");
  });
  it("buildAssistantContext folds DNA voice + brand, empty when nothing", () => {
    expect(buildAssistantContext({ dna: null })).toBe("");
    const ctx = buildAssistantContext({ dna: DNA, brand: "" });
    expect(ctx).toContain("<BRAND>");
    expect(ctx).toContain("مصري"); // dialect
  });
});
