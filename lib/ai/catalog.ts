/** Provider + model catalog shared by the UI (dropdowns) and the server
 * (validation). Pure data — safe to import in client components. */
export type ProviderId = "anthropic" | "minimax";

export const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "anthropic", label: "Claude" },
  { id: "minimax", label: "MiniMax" },
];

export const MODEL_CATALOG: Record<ProviderId, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
  ],
  minimax: [
    { id: "MiniMax-M2", label: "MiniMax-M2" },
    { id: "MiniMax-M2.5", label: "MiniMax-M2.5" },
    { id: "MiniMax-M2.7", label: "MiniMax-M2.7" },
    { id: "MiniMax-M3", label: "MiniMax-M3" },
  ],
};

export const DEFAULT_PROVIDER: ProviderId = "anthropic";
export const DEFAULT_MODEL = MODEL_CATALOG.anthropic[0].id; // Claude Haiku 4.5

export function isValidSelection(provider: string, model: string): boolean {
  const list = MODEL_CATALOG[provider as ProviderId];
  return Boolean(list) && list.some((m) => m.id === model);
}
