/** Arabic-aware semantic chunking (ADR-003). Splits on Arabic + Latin sentence
 * terminators and blank lines, then packs sentences into ~maxChars windows with a
 * small overlap so a retrieved chunk keeps enough surrounding context. Character
 * budgets (not tokens) keep it dependency-free; Arabic runs ~2–3 chars/token. */

export type Chunk = { idx: number; content: string };

export function chunkArabic(
  text: string,
  opts?: { maxChars?: number; overlap?: number },
): Chunk[] {
  const maxChars = opts?.maxChars ?? 900;
  const overlap = opts?.overlap ?? 120;
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
  return out.filter(Boolean).map((content, idx) => ({ idx, content }));
}
