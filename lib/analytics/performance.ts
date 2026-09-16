/**
 * "What actually works for you" (Phase 8).
 *
 * Pure, no DB, no network: every rule about what may be claimed is testable
 * against plain objects.
 *
 * The whole value of this module is what it REFUSES to say. With four posts you
 * cannot tell a customer that story posts outperform teaching posts — you can
 * only tell them that. An analytics screen that produces a confident finding
 * from three data points is a horoscope, and the first time its advice fails
 * the customer stops believing the rest of the product too.
 *
 * So every comparison has to clear three bars before it is shown, and when it
 * does not, the screen says exactly how many more published posts are needed.
 */

export type MeasuredPost = {
  draftId: string;
  platform: string;
  hook: string;
  body: string;
  /** Our own pre-publication guess, kept so we can check it against reality. */
  postScore: number;
  /** Weighted engagement; null when the platform told us nothing. */
  engagement: number | null;
  impressions: number | null;
  /** Local hour and weekday in the BRAND's timezone, computed by the query.
   * Never derived here from a UTC timestamp — an offset of a few hours moves a
   * late-evening post to the wrong day, and a wrong "best day to post" is worse
   * than none. */
  localHour: number | null;
  localWeekday: number | null;
  externalUrl: string | null;
  publishedAt: Date | null;
};

/** Posts with a known number before ANY comparison is attempted. Below this the
 * screen reports totals and stays quiet about causes. */
export const MIN_MEASURED = 8;
/** Posts on each side of a comparison. Two-versus-two is an anecdote. */
export const MIN_BUCKET = 3;
/** How much better the winner must be. Below this the gap is noise, and naming
 * a winner would send the customer chasing it. */
export const MIN_LIFT = 1.25;

export type Finding = {
  /** Which dimension separated them: platform | length | timing | day | hook. */
  dimension: "platform" | "length" | "timing" | "day" | "hook";
  /** Machine-readable bucket keys; the UI translates them. */
  winner: string;
  loser: string;
  winnerAvg: number;
  loserAvg: number;
  /** How many times better, e.g. 2.3. */
  lift: number;
  /** Posts behind the whole comparison — shown, so the reader can judge it. */
  sample: number;
};

export type ScoreCheck = {
  /** True when our own score actually tracked real engagement. */
  predictive: boolean;
  topAvg: number;
  restAvg: number;
  sample: number;
};

export type PerformanceReport = {
  measured: number;
  unmeasured: number;
  avgEngagement: number;
  totalImpressions: number | null;
  best: MeasuredPost | null;
  findings: Finding[];
  /** 0 when there is enough data; otherwise how many more posts are needed. */
  needMore: number;
  scoreCheck: ScoreCheck | null;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Only posts we actually have a number for. Everything downstream works on
 * these, so an unmeasured post can never dilute an average toward zero. */
export function measuredOnly(posts: MeasuredPost[]): (MeasuredPost & { engagement: number })[] {
  return posts.filter((p): p is MeasuredPost & { engagement: number } => p.engagement !== null);
}

/** Body length, bucketed the way a writer thinks about it rather than by
 * character count. */
export function lengthBucket(body: string): "short" | "medium" | "long" {
  const n = [...(body ?? "")].length;
  if (n <= 400) return "short";
  if (n <= 1100) return "medium";
  return "long";
}

/** Part of the day, in the brand's own timezone. */
export function timeBucket(hour: number | null): "morning" | "midday" | "evening" | "night" | null {
  if (hour === null || !Number.isFinite(hour)) return null;
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "midday";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/**
 * An observable property of the hook, not a judgement about it.
 *
 * These are things anyone can verify by looking at the text — it asks a
 * question, it leads with a number, it does neither — so a finding built on
 * them is checkable rather than mystical.
 */
export function hookBucket(hook: string): "question" | "number" | "plain" {
  const h = hook ?? "";
  if (/[?؟]/.test(h)) return "question";
  // Arabic-Indic digits as well as Latin ones.
  if (/[0-9٠-٩]/.test(h)) return "number";
  return "plain";
}

/**
 * Compare buckets on one dimension and return a finding only if it survives.
 *
 * Best against worst, not best against the mean: "your evening posts beat your
 * morning ones" is something a person can act on tomorrow, while "above
 * average" is not.
 */
export function compareBuckets(
  posts: (MeasuredPost & { engagement: number })[],
  dimension: Finding["dimension"],
  bucketOf: (p: MeasuredPost) => string | null,
): Finding | null {
  const groups = new Map<string, number[]>();
  for (const p of posts) {
    const b = bucketOf(p);
    if (!b) continue;
    const arr = groups.get(b) ?? [];
    arr.push(p.engagement);
    groups.set(b, arr);
  }

  // Only buckets with enough posts to mean anything.
  const eligible = [...groups.entries()].filter(([, xs]) => xs.length >= MIN_BUCKET);
  if (eligible.length < 2) return null;

  const ranked = eligible
    .map(([key, xs]) => ({ key, mean: avg(xs), n: xs.length }))
    .sort((a, b) => b.mean - a.mean);

  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  // A zero-engagement loser would make every lift infinite; that is not a
  // finding, it is a division by zero wearing a hat.
  if (bottom.mean <= 0 || top.mean <= 0) return null;

  const lift = top.mean / bottom.mean;
  if (lift < MIN_LIFT) return null;

  return {
    dimension,
    winner: top.key,
    loser: bottom.key,
    winnerAvg: round2(top.mean),
    loserAvg: round2(bottom.mean),
    lift: round2(lift),
    sample: top.n + bottom.n,
  };
}

/**
 * Did our own pre-publication score track reality?
 *
 * Worth showing precisely because it can come back negative. A product that
 * displays a quality score owes the customer an honest account of whether that
 * score means anything, and "it did not predict your results" is useful to
 * them and to us.
 */
export function checkScore(posts: (MeasuredPost & { engagement: number })[]): ScoreCheck | null {
  if (posts.length < MIN_MEASURED) return null;
  const sorted = [...posts].sort((a, b) => b.postScore - a.postScore);
  const cut = Math.max(MIN_BUCKET, Math.floor(sorted.length / 3));
  const top = sorted.slice(0, cut).map((p) => p.engagement);
  const rest = sorted.slice(cut).map((p) => p.engagement);
  if (!top.length || !rest.length) return null;

  const topAvg = avg(top);
  const restAvg = avg(rest);
  return {
    predictive: restAvg > 0 ? topAvg / restAvg >= MIN_LIFT : topAvg > 0,
    topAvg: round2(topAvg),
    restAvg: round2(restAvg),
    sample: posts.length,
  };
}

/** The whole report. Findings are ordered by lift so the strongest reads first. */
export function buildReport(posts: MeasuredPost[]): PerformanceReport {
  const measured = measuredOnly(posts);
  const impressions = posts.map((p) => p.impressions).filter((v): v is number => v !== null);

  const base: PerformanceReport = {
    measured: measured.length,
    unmeasured: posts.length - measured.length,
    avgEngagement: round2(avg(measured.map((p) => p.engagement))),
    totalImpressions: impressions.length ? impressions.reduce((a, b) => a + b, 0) : null,
    best: measured.length ? [...measured].sort((a, b) => b.engagement - a.engagement)[0] : null,
    findings: [],
    needMore: Math.max(0, MIN_MEASURED - measured.length),
    scoreCheck: null,
  };

  // Below the floor we report totals and say nothing about causes.
  if (measured.length < MIN_MEASURED) return base;

  const findings = [
    compareBuckets(measured, "platform", (p) => p.platform || null),
    compareBuckets(measured, "length", (p) => lengthBucket(p.body)),
    compareBuckets(measured, "timing", (p) => timeBucket(p.localHour)),
    compareBuckets(measured, "day", (p) => (p.localWeekday === null ? null : String(p.localWeekday))),
    compareBuckets(measured, "hook", (p) => hookBucket(p.hook)),
  ].filter((f): f is Finding => f !== null);

  return {
    ...base,
    findings: findings.sort((a, b) => b.lift - a.lift),
    scoreCheck: checkScore(measured),
  };
}
