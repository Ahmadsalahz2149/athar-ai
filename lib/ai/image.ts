/** MiniMax image generation (Phase 3 #1). Same key as the MiniMax text provider.
 * Returns hosted image URLs the client can display/download. */

export function hasImageKey(): boolean {
  return !!process.env.MINIMAX_API_KEY;
}

const MODEL = process.env.MINIMAX_IMAGE_MODEL || "image-01";

export type ImageAspect = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

/** Generate `n` images for a prompt; returns their URLs. */
export async function generateImages(prompt: string, opts?: { aspectRatio?: ImageAspect; n?: number }): Promise<string[]> {
  const base = (process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1").replace(/\/$/, "");
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw new Error("MINIMAX_API_KEY is not set");
  const res = await fetch(`${base}/image_generation`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt.slice(0, 1500),
      aspect_ratio: opts?.aspectRatio || "1:1",
      response_format: "url",
      n: Math.min(4, Math.max(1, opts?.n ?? 1)),
      prompt_optimizer: true,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { image_urls?: string[] } | string[];
    base_resp?: { status_code?: number; status_msg?: string };
  };
  // MiniMax returns 200 with a base_resp code even on logical errors.
  const code = json?.base_resp?.status_code;
  if (!res.ok || (typeof code === "number" && code !== 0)) {
    throw new Error(`MiniMax image ${res.status}/${code}: ${json?.base_resp?.status_msg ?? JSON.stringify(json).slice(0, 200)}`);
  }
  const d = json?.data;
  const urls = Array.isArray(d) ? d : d?.image_urls ?? [];
  return (Array.isArray(urls) ? urls : []).filter((u): u is string => typeof u === "string" && !!u);
}
