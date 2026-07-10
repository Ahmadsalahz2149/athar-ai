/** Voyage embeddings (ADR-003/008). Model + dimensions are pinned here; changing
 * the model later means re-embedding every chunk (the vector column is fixed at
 * EMBED_DIMS). voyage-3 is multilingual and strong on Arabic. */

export const EMBED_MODEL = process.env.VOYAGE_MODEL || "voyage-3";
export const EMBED_DIMS = 1024;
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";
const MAX_BATCH = 128; // Voyage caps inputs per request.

export function hasEmbeddingKey(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST to Voyage with backoff on 429 (free tier is 3 RPM until a payment method
 * is added) and 5xx. Up to 4 retries: ~2s, 4s, 8s, 16s (or Retry-After). */
async function postVoyage(body: unknown, key: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (res.ok || (res.status !== 429 && res.status < 500) || attempt >= 4) return res;
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(retryAfter > 0 ? retryAfter * 1000 : Math.min(16000, 2000 * 2 ** attempt));
  }
}

/** Embed many texts, preserving order. `document` for stored chunks, `query` for
 * search text (Voyage optimizes each differently). */
export async function embed(
  texts: string[],
  inputType: "document" | "query" = "document",
): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is not set");
  if (texts.length === 0) return [];
  const out: number[][] = new Array(texts.length);
  for (let start = 0; start < texts.length; start += MAX_BATCH) {
    const batch = texts.slice(start, start + MAX_BATCH);
    const res = await postVoyage({ model: EMBED_MODEL, input: batch, input_type: inputType }, key);
    if (!res.ok) {
      throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    for (const d of json.data) out[start + d.index] = d.embedding;
  }
  return out;
}

export async function embedOne(
  text: string,
  inputType: "document" | "query" = "query",
): Promise<number[]> {
  return (await embed([text], inputType))[0];
}
