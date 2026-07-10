/** Credit costs (client-safe — no server-only). Prices are in credits, not files
 * (ADR-004). Tune against docs/UNIT_ECONOMICS.md once Design Partners set pricing. */

export const START_GRANT = 200;

export const COSTS = {
  dna: 10,
  draft: 2,
  ingest: 3,
} as const;

export function estimateIngest(): number {
  return COSTS.ingest;
}

export function estimateStudio(count: number): number {
  const n = Math.max(1, Math.min(5, Math.floor(count) || 1));
  return COSTS.dna + n * COSTS.draft;
}

export function estimateDna(): number {
  return COSTS.dna;
}
