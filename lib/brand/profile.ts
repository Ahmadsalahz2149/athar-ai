/** Brand profile (Phase 1) — identity depth beyond the DNA. Stored as jsonb on
 * the brand and injected into content generation. Every field is optional so a
 * brand created before this existed still normalizes cleanly. */
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
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 20) : []);
  const qa = Array.isArray(o.qa)
    ? (o.qa as unknown[])
        .filter((x): x is { q: unknown; a: unknown } => !!x && typeof x === "object")
        .map((x) => ({ q: str(x.q), a: str(x.a) }))
        .filter((x) => x.q || x.a)
        .slice(0, 20)
    : [];
  return {
    constraints: arr(o.constraints),
    productionNotes: str(o.productionNotes),
    teamSize: str(o.teamSize),
    descShort: str(o.descShort),
    descDetailed: str(o.descDetailed),
    descTechnical: str(o.descTechnical),
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
