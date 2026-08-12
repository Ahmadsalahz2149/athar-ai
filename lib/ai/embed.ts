/** Voyage embeddings (ADR-003/008). Model + dimensions are pinned here; changing
 * the model later means re-embedding every chunk (the vector column is fixed at
 * EMBED_DIMS). voyage-3 is multilingual and strong on Arabic. */

export const EMBED_MODEL = process.env.VOYAGE_MODEL || "voyage-3";
export const EMBED_DIMS = 1024;
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";
const MAX_BATCH = 128; // Voyage caps inputs per request.
// Unfunded Voyage projects are limited to 10K input tokens/minute. Arabic can
// tokenize close to one token per 1.5 characters, so keep each request below
// ~4.5K conservatively and issue at most two requests per minute.
const MAX_ESTIMATED_TOKENS_PER_BATCH = 4_500;
const FREE_TIER_BATCH_PAUSE_MS = 31_000;

export function hasEmbeddingKey(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function estimatedTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 1.5));
}

function planBatches(texts: string[]): { start: number; values: string[] }[] {
  const batches: { start: number; values: string[] }[] = [];
  let start = 0;
  let values: string[] = [];
  let tokens = 0;
  for (let index = 0; index < texts.length; index++) {
    const value = texts[index];
    const nextTokens = estimatedTokens(value);
    if (values.length && (values.length >= MAX_BATCH || tokens + nextTokens > MAX_ESTIMATED_TOKENS_PER_BATCH)) {
      batches.push({ start, values });
      start = index;
      values = [];
      tokens = 0;
    }
    values.push(value);
    tokens += nextTokens;
  }
  if (values.length) batches.push({ start, values });
  return batches;
}

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
  const batches = planBatches(texts);
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const { start, values } = batches[batchIndex];
    if (batchIndex > 0) await sleep(FREE_TIER_BATCH_PAUSE_MS);
    const res = await postVoyage({ model: EMBED_MODEL, input: values, input_type: inputType }, key);
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
