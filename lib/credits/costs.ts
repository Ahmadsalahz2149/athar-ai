/** Credit costs (client-safe — no server-only). Prices are in credits, not files
 * (ADR-004). Tune against docs/UNIT_ECONOMICS.md once Design Partners set pricing. */

export const START_GRANT = 200;

export const COSTS = {
  dna: 10,
  draft: 2,
  ingest: 3,
  transcribe: 15,
  analyze: 8,
  idea: 1,
} as const;

export function estimateAnalyze(): number {
  return COSTS.analyze;
}

export function estimateIdeas(count: number): number {
  return Math.max(1, count) * COSTS.idea;
}

/** Studio compose (1 body + 3 hook variants) and each rewrite tool. */
export function estimateCompose(): number {
  return COSTS.draft * 3;
}
export function estimateRewrite(): number {
  return COSTS.draft;
}

export function estimateIngest(): number {
  return COSTS.ingest;
}

export function estimateTranscribe(): number {
  return COSTS.transcribe;
}

export function estimateStudio(count: number): number {
  const n = Math.max(1, Math.min(5, Math.floor(count) || 1));
  return COSTS.dna + n * COSTS.draft;
}

export function estimateDna(): number {
  return COSTS.dna;
}
