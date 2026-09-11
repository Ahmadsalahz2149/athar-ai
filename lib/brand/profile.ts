/** Brand profile (Phase 1) — identity depth beyond the DNA. Stored as jsonb on
 * the brand and injected into content generation. Every field is optional so a
 * brand created before this existed still normalizes cleanly. */
import { capList, capStr, PROFILE_CAPS } from "@/lib/text/cap";

export type BrandProfile = {
  constraints: string[];        // #10 content rules ("no client faces", "no music")
  productionNotes: string;      // #11 shooting / production guidance
  teamSize: string;             // #12 team size (solo / small / agency)
  descShort: string;            // #13 simple description
  descDetailed: string;         // #13 detailed description
  descTechnical: string;        // #13 technical/business description
  qa: { q: string; a: string }[]; // #14 identity Q&A
};

export const EMPTY_PROFILE: BrandProfile = {
  constraints: [], productionNotes: "", teamSize: "", descShort: "", descDetailed: "", descTechnical: "", qa: [],
};

export function normalizeProfile(raw: unknown): BrandProfile {
  const o = (raw ?? {}) as Record<string, unknown>;
  // Counts were capped here already; the strings inside them were not, and this
  // profile is injected into generation prompts like the DNA is.
  const arr = (v: unknown) => capList(v, PROFILE_CAPS.constraintItems, PROFILE_CAPS.constraintChars);
  const qa = Array.isArray(o.qa)
    ? (o.qa as unknown[])
        .filter((x): x is { q: unknown; a: unknown } => !!x && typeof x === "object")
        .map((x) => ({ q: capStr(x.q, PROFILE_CAPS.qaQuestion), a: capStr(x.a, PROFILE_CAPS.qaAnswer) }))
        .filter((x) => x.q || x.a)
        .slice(0, PROFILE_CAPS.qaItems)
    : [];
  return {
    constraints: arr(o.constraints),
    productionNotes: capStr(o.productionNotes, PROFILE_CAPS.productionNotes),
    teamSize: capStr(o.teamSize, PROFILE_CAPS.teamSize),
    descShort: capStr(o.descShort, PROFILE_CAPS.descShort),
    descDetailed: capStr(o.descDetailed, PROFILE_CAPS.descDetailed),
    descTechnical: capStr(o.descTechnical, PROFILE_CAPS.descTechnical),
    qa,
  };
}

/** True when the profile has any content worth injecting into a prompt. */
export function profileHasContent(p: BrandProfile): boolean {
  return (
    p.constraints.length > 0 || !!p.productionNotes || !!p.teamSize ||
    !!p.descShort || !!p.descDetailed || !!p.descTechnical || p.qa.length > 0
  );
}
