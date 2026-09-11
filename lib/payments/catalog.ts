/**
 * Credit packs — the single source of truth for what can be bought and for how
 * much. Pure and shared by the billing UI and the server, but the SERVER is
 * authoritative: checkout is created from this table by `id` only, so a caller
 * cannot ask for 4000 credits at the price of 500 by editing the request.
 *
 * Prices are integer cents to avoid float drift, in USD.
 */
export type CreditPack = {
  id: string;
  credits: number;
  /** Price in the smallest currency unit (cents). */
  amountCents: number;
};

export const CURRENCY = "usd";

export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: "pack_500", credits: 500, amountCents: 29_00 },
  { id: "pack_1500", credits: 1500, amountCents: 69_00 },
  { id: "pack_4000", credits: 4000, amountCents: 149_00 },
] as const;

export function findPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

/** Display helper: whole dollars for the UI (every pack is priced in round dollars). */
export function packPriceUsd(p: CreditPack): number {
  return p.amountCents / 100;
}
