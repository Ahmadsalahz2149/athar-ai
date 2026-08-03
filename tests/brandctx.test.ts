import { describe, it, expect } from "vitest";
import { buildBrandContext, buildStudioMessage, buildIdeasUserMessage } from "@/lib/ai/prompts";
import { normalizeProfile } from "@/lib/brand/profile";

const dna = { summary:"s", dialect:"خليجي", tone_traits:[], hook_patterns:[], audience:"a", dos:[], donts:[], explanation_style:"", sentence_length:2, boldness:2, awareness:"", cares_about:[], cta_patterns:[], pillars:{educational:50,story:10,proof:10,soft_sell:10,thought_leadership:10,engagement:10}, completion_pct:80 } as never;

describe("buildBrandContext (Phase 1 injection)", () => {
  it("returns empty string when nothing to inject", () => {
    expect(buildBrandContext({ profile: normalizeProfile(null), products: [] })).toBe("");
  });
  it("emits products + constraints + descriptions + qa in a BRAND block", () => {
    const profile = normalizeProfile({ constraints:["لا تُظهر وجوه العملاء"], descShort:"منصة نمو", teamSize:"solo", qa:[{q:"ما ميزتك؟",a:"العمق"}] });
    const products = [{ name:"باقة النمو", kind:"service", description:"إدارة محتوى", price:"٩٩٩ ر.س", url:null }];
    const block = buildBrandContext({ profile, products });
    expect(block).toContain("<BRAND>");
    expect(block).toContain("باقة النمو");
    expect(block).toContain("لا تُظهر وجوه العملاء");
    expect(block).toContain("منصة نمو");
    expect(block).toContain("ما ميزتك؟");
  });
  it("studio + ideas builders include the brand block when provided", () => {
    const brand = buildBrandContext({ profile: normalizeProfile({ constraints:["قيد"] }), products: [] });
    const s = buildStudioMessage({ dna, prompt:"p", platform:"x", format:"post", tone:"t", length:"short", brand });
    const i = buildIdeasUserMessage({ dna, count:5, brand });
    expect(s).toContain("<BRAND>");
    expect(s).toContain("قيد");
    expect(i).toContain("<BRAND>");
  });
  it("omits the block cleanly when brand is undefined", () => {
    const s = buildStudioMessage({ dna, prompt:"p", platform:"x", format:"post", tone:"t", length:"short" });
    expect(s).not.toContain("<BRAND>");
  });
});
