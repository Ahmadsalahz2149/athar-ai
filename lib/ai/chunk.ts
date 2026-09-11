/** Arabic-aware semantic chunking (ADR-003). Splits on Arabic + Latin sentence
 * terminators and blank lines, then packs sentences into ~maxChars windows with a
 * small overlap so a retrieved chunk keeps enough surrounding context. Character
 * budgets (not tokens) keep it dependency-free; Arabic runs ~2–3 chars/token. */

export type Chunk = { idx: number; content: string };

/**
 * Hard ceiling on how many chunks one source may produce.
 *
 * Every chunk is an embedding call and a stored 1024-dimension vector, while
 * ingestion is charged a FLAT credit cost — so without a ceiling one payment
 * bought unbounded provider spend and unbounded storage. It would also sail
 * past the embedding provider's rate limit, which the batching in embed.ts
 * exists specifically to respect.
 *
 * 600 chunks is roughly 540 KB of text: a three-hour transcript or a
 * 300-page book, comfortably above any single real source.
 */
export const MAX_CHUNKS = 600;

export function chunkArabic(
  text: string,
  opts?: { maxChars?: number; overlap?: number; maxChunks?: number },
): Chunk[] {
  const maxChars = opts?.maxChars ?? 900;
  const overlap = opts?.overlap ?? 120;
  const maxChunks = Math.max(1, opts?.maxChunks ?? MAX_CHUNKS);
  const clean = (text ?? "").replace(/\r/g, "").trim();
  if (!clean) return [];

  // Sentence-ish units: break after . ؟ ! ? or a newline, keeping the text.
  const units = clean
    .split(/(?<=[.؟!?])\s+|\n{1,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  const packed: string[] = [];
  let cur = "";
  for (const u of units) {
    // Stop packing once the ceiling is reached — the loop below can only add
    // more, so continuing would just build chunks we are about to discard.
    if (packed.length >= maxChunks) break;
    if (cur && cur.length + 1 + u.length > maxChars) {
      packed.push(cur);
      const tail = overlap > 0 ? cur.slice(-overlap) : "";
      cur = tail ? `${tail} ${u}` : u;
    } else {
      cur = cur ? `${cur} ${u}` : u;
    }
  }
  if (cur.trim()) packed.push(cur.trim());

  // Hard-split any single unit that blew past the budget (e.g. no punctuation).
  const out: string[] = [];
  for (const c of packed) {
    if (c.length <= maxChars * 1.5) out.push(c);
    else for (let i = 0; i < c.length; i += maxChars) out.push(c.slice(i, i + maxChars).trim());
  }
  // The hard-split above can turn one oversized unit into many, so the ceiling
  // is applied once more at the end rather than trusted from the packing loop.
  return out.filter(Boolean).slice(0, maxChunks).map((content, idx) => ({ idx, content }));
}
