import { describe, it, expect } from "vitest";
import {
  MIN_BUCKET, MIN_LIFT, MIN_MEASURED, buildReport, checkScore, compareBuckets,
  hookBucket, lengthBucket, measuredOnly, timeBucket, type MeasuredPost,
} from "@/lib/analytics/performance";

/**
 * These tests exist for what the module REFUSES to say.
 *
 * An analytics screen that produces a confident finding from three data points
 * is a horoscope, and the first time its advice fails the customer stops
 * believing the rest of the product. Every assertion below about silence is
 * load-bearing.
 */
let seq = 0;
function post(over: Partial<MeasuredPost> = {}): MeasuredPost {
  seq += 1;
  return {
    draftId: `d${seq}`,
    platform: "x",
    hook: "عنوان عادي",
    body: "نص".repeat(50),
    postScore: 50,
    engagement: 10,
    impressions: 100,
    localHour: 12,
    localWeekday: 1,
    externalUrl: null,
    publishedAt: new Date("2026-09-01T09:00:00Z"),
    ...over,
  };
}
const many = (n: number, over: Partial<MeasuredPost> = {}) => Array.from({ length: n }, () => post(over));

describe("buckets", () => {
  it("splits length the way a writer thinks about it", () => {
    expect(lengthBucket("ا".repeat(100))).toBe("short");
    expect(lengthBucket("ا".repeat(700))).toBe("medium");
    expect(lengthBucket("ا".repeat(2000))).toBe("long");
  });

  it("counts Arabic by code point, not UTF-16 unit", () => {
    // 400 Arabic letters is short; the boundary must not shift because the
    // characters are non-Latin.
    expect(lengthBucket("ا".repeat(400))).toBe("short");
    expect(lengthBucket("ا".repeat(401))).toBe("medium");
  });

  it("buckets the day and refuses to guess when the hour is unknown", () => {
    expect(timeBucket(7)).toBe("morning");
    expect(timeBucket(13)).toBe("midday");
    expect(timeBucket(19)).toBe("evening");
    expect(timeBucket(2)).toBe("night");
    expect(timeBucket(null)).toBeNull();
  });

  // Observable properties of the text, so a finding built on them is checkable
  // rather than mystical.
  it("reads the hook's shape, including Arabic punctuation and digits", () => {
    expect(hookBucket("كيف تكتب أفضل؟")).toBe("question");
    expect(hookBucket("٣ أخطاء شائعة")).toBe("number");
    expect(hookBucket("5 mistakes")).toBe("number");
    expect(hookBucket("الطريقة التي غيّرت عملي")).toBe("plain");
  });
});

describe("measuredOnly", () => {
  // An unmeasured post is not a zero. Letting it through would drag every
  // average down and make a well-performing brand look like it is failing.
  it("drops posts with no number rather than counting them as zero", () => {
    const posts = [post({ engagement: 10 }), post({ engagement: null }), post({ engagement: 0 })];
    const out = measuredOnly(posts);
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.engagement)).toEqual([10, 0]); // a real zero stays
  });
});

describe("compareBuckets", () => {
  it("stays silent when either side is too small", () => {
    const posts = measuredOnly([
      ...many(2, { platform: "x", engagement: 100 }),
      ...many(5, { platform: "linkedin", engagement: 10 }),
    ]);
    // A two-post bucket is an anecdote no matter how large the gap.
    expect(compareBuckets(posts, "platform", (p) => p.platform)).toBeNull();
  });

  it("stays silent when the gap is within noise", () => {
    const posts = measuredOnly([
      ...many(MIN_BUCKET, { platform: "x", engagement: 11 }),
      ...many(MIN_BUCKET, { platform: "linkedin", engagement: 10 }),
    ]);
    expect(compareBuckets(posts, "platform", (p) => p.platform)).toBeNull();
  });

  it("reports a real, well-sampled difference", () => {
    const posts = measuredOnly([
      ...many(4, { platform: "x", engagement: 40 }),
      ...many(4, { platform: "linkedin", engagement: 10 }),
    ]);
    const f = compareBuckets(posts, "platform", (p) => p.platform)!;
    expect(f).toMatchObject({ dimension: "platform", winner: "x", loser: "linkedin", lift: 4, sample: 8 });
  });

  // Best against worst, not best against the mean: "your evening posts beat
  // your morning ones" is something a person can act on tomorrow.
  it("compares the best bucket with the worst, not with the average", () => {
    const posts = measuredOnly([
      ...many(3, { platform: "x", engagement: 30 }),
      ...many(3, { platform: "linkedin", engagement: 20 }),
      ...many(3, { platform: "instagram", engagement: 10 }),
    ]);
    const f = compareBuckets(posts, "platform", (p) => p.platform)!;
    expect(f.winner).toBe("x");
    expect(f.loser).toBe("instagram");
    expect(f.lift).toBe(3);
  });

  // An infinite lift is a division by zero wearing a hat, not a finding.
  it("refuses to divide by a bucket that scored nothing", () => {
    const posts = measuredOnly([
      ...many(3, { platform: "x", engagement: 50 }),
      ...many(3, { platform: "linkedin", engagement: 0 }),
    ]);
    expect(compareBuckets(posts, "platform", (p) => p.platform)).toBeNull();
  });

  it("ignores posts whose bucket cannot be determined", () => {
    const posts = measuredOnly([
      ...many(3, { localHour: 19, engagement: 40 }),
      ...many(3, { localHour: 7, engagement: 10 }),
      ...many(5, { localHour: null, engagement: 999 }), // unknown time, must not count
    ]);
    const f = compareBuckets(posts, "timing", (p) => timeBucket(p.localHour))!;
    expect(f.sample).toBe(6);
    expect(f.winner).toBe("evening");
  });
});

describe("checkScore", () => {
  // Worth showing precisely because it can come back negative: a product that
  // displays a quality score owes an honest account of whether it means
  // anything.
  it("says so when our own score did track reality", () => {
    const posts = measuredOnly([
      ...many(4, { postScore: 90, engagement: 60 }),
      ...many(6, { postScore: 30, engagement: 10 }),
    ]);
    const c = checkScore(posts)!;
    expect(c.predictive).toBe(true);
    expect(c.topAvg).toBeGreaterThan(c.restAvg);
  });

  it("says so when it did not", () => {
    const posts = measuredOnly([
      ...many(4, { postScore: 90, engagement: 10 }),
      ...many(6, { postScore: 30, engagement: 50 }),
    ]);
    expect(checkScore(posts)!.predictive).toBe(false);
  });

  it("will not judge its own score on too little evidence", () => {
    expect(checkScore(measuredOnly(many(MIN_MEASURED - 1)))).toBeNull();
  });
});

describe("buildReport", () => {
  it("reports totals but no causes below the floor, and says how many more are needed", () => {
    const r = buildReport(many(3, { engagement: 20 }));
    expect(r.measured).toBe(3);
    expect(r.findings).toEqual([]);
    expect(r.scoreCheck).toBeNull();
    expect(r.needMore).toBe(MIN_MEASURED - 3);
    expect(r.avgEngagement).toBe(20); // the honest part is still shown
  });

  it("counts unmeasured posts separately instead of hiding them", () => {
    const r = buildReport([...many(3, { engagement: 20 }), ...many(2, { engagement: null })]);
    expect(r.measured).toBe(3);
    expect(r.unmeasured).toBe(2);
  });

  it("opens up once there is enough evidence", () => {
    const r = buildReport([
      ...many(5, { platform: "x", engagement: 50, hook: "كيف تبدأ؟" }),
      ...many(5, { platform: "linkedin", engagement: 10, hook: "ملاحظة اليوم" }),
    ]);
    expect(r.needMore).toBe(0);
    expect(r.findings.length).toBeGreaterThan(0);
    expect(r.scoreCheck).not.toBeNull();
  });

  it("puts the strongest finding first", () => {
    const r = buildReport([
      ...many(4, { platform: "x", engagement: 100, body: "ا".repeat(100) }),
      ...many(4, { platform: "linkedin", engagement: 5, body: "ا".repeat(2000) }),
    ]);
    const lifts = r.findings.map((f) => f.lift);
    expect([...lifts].sort((a, b) => b - a)).toEqual(lifts);
  });

  it("names the single best post so there is something concrete to look at", () => {
    const r = buildReport([...many(4, { engagement: 5 }), post({ engagement: 900, hook: "البوست الأفضل" })]);
    expect(r.best?.hook).toBe("البوست الأفضل");
  });

  it("holds up with nothing measured at all", () => {
    const r = buildReport(many(4, { engagement: null, impressions: null }));
    expect(r).toMatchObject({ measured: 0, unmeasured: 4, avgEngagement: 0, findings: [], best: null });
    expect(r.totalImpressions).toBeNull(); // unknown, not zero
    expect(r.needMore).toBe(MIN_MEASURED);
  });

  it("holds up with no posts at all", () => {
    expect(buildReport([])).toMatchObject({ measured: 0, unmeasured: 0, findings: [], best: null });
  });

  it("keeps its thresholds sane", () => {
    expect(MIN_LIFT).toBeGreaterThan(1);
    expect(MIN_MEASURED).toBeGreaterThanOrEqual(2 * MIN_BUCKET);
  });
});
