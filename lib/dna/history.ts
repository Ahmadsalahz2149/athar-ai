import { normalizeLearnedFrom } from "@/lib/ai/normalize";

/** A stored DNA version, as the façade returns it. */
export type StoredVersion = {
  id: string;
  version: number;
  completionPct: number;
  learnedFromPosts: unknown;
  createdAt: Date;
};

/** One row of the history list, with every string already formatted. */
export type HistoryRow = {
  id: string;
  version: number;
  current: boolean;
  meta: string;
  learnedLabel: string;
  learnedFrom: { hook: string; engagementLabel: string }[];
};

/** The formatters the page supplies — the locale, calendar and ICU messages all
 * live on the server, so nothing has to be re-derived in the browser. */
export type HistoryFormat = {
  date: (d: Date) => string;
  complete: (pct: number) => string;
  learned: (n: number) => string;
  learnedNone: string;
  engagement: (n: number) => string;
};

/**
 * Shape stored DNA versions into the history list.
 *
 * Pure, so the one piece of logic that can quietly go wrong — which version is
 * the CURRENT one — is testable. Getting that backwards would offer a "revert"
 * on the version already in use and hide it on the one the user wants back,
 * which is worse than having no history at all.
 *
 * `currentVersion` is the version NUMBER the brand points at; null when the
 * brand has no current pointer, in which case no row claims to be current.
 */
export function buildHistoryRows(
  versions: StoredVersion[],
  currentVersion: number | null,
  fmt: HistoryFormat,
): HistoryRow[] {
  return versions.map((v) => {
    const learned = normalizeLearnedFrom(v.learnedFromPosts);
    return {
      id: v.id,
      version: v.version,
      current: currentVersion !== null && v.version === currentVersion,
      meta: `${fmt.date(v.createdAt)} · ${fmt.complete(v.completionPct)}`,
      learnedLabel: learned.length ? fmt.learned(learned.length) : fmt.learnedNone,
      learnedFrom: learned.map((p) => ({ hook: p.hook, engagementLabel: fmt.engagement(p.engagement) })),
    };
  });
}
