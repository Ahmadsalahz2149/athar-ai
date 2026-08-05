/** Monthly content plan (Phase 2 #5) + trends (#6), stored on content_plans.payload. */

export type PlanItem = {
  day: number;      // day of month (1-31)
  pillar: string;   // educational | story | proof | soft_sell | thought_leadership | engagement
  title: string;    // post idea title
  angle: string;    // one-line treatment
  format: string;   // post | thread | carousel | reel | short
};

export type MonthlyPlan = {
  plan: PlanItem[];
  trends: string[];     // trend angles for the month
  generatedAt: string | null;
};

export const EMPTY_PLAN: MonthlyPlan = { plan: [], trends: [], generatedAt: null };

const PILLARS = ["educational", "story", "proof", "soft_sell", "thought_leadership", "engagement"];
const FORMATS = ["post", "thread", "carousel", "reel", "short"];

export function normalizePlan(raw: unknown): MonthlyPlan {
  const o = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const plan = Array.isArray(o.plan)
    ? (o.plan as unknown[])
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((x) => ({
          day: Math.min(31, Math.max(1, Math.round(Number(x.day) || 1))),
          pillar: PILLARS.includes(str(x.pillar)) ? str(x.pillar) : "educational",
          title: str(x.title).slice(0, 200),
          angle: str(x.angle).slice(0, 300),
          format: FORMATS.includes(str(x.format)) ? str(x.format) : "post",
        }))
        .filter((x) => x.title)
        .slice(0, 40)
        .sort((a, b) => a.day - b.day)
    : [];
  const trends = Array.isArray(o.trends)
    ? (o.trends as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 12)
    : [];
  return { plan, trends, generatedAt: str(o.generatedAt) || null };
}

export function planHasContent(p: MonthlyPlan): boolean {
  return p.plan.length > 0 || p.trends.length > 0;
}

/** 'YYYY-MM' for a given year/month (month is 1-12). */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
