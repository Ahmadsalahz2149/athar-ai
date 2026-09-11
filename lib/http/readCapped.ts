/**
 * Read a response body while enforcing a byte cap *as it streams*.
 *
 * Buffering first and checking the size afterwards makes the cap decorative: a
 * hostile or broken upstream serving a multi-GB body exhausts memory before the
 * size is ever tested. This checks the declared length, then counts bytes as
 * they arrive and stops the moment the limit is passed.
 *
 * Deliberately free of `server-only` and of any project import, so it is a
 * plain, testable function usable from every fetch path.
 */
export async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) throw new Error("content too large");
  if (!res.body) {
    const b = new Uint8Array(await res.arrayBuffer());
    if (b.byteLength > max) throw new Error("content too large");
    return b;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) throw new Error("content too large");
      chunks.push(value);
    }
  } finally {
    // Release the connection even on the error path, or a rejected download
    // leaves a socket held open until it times out.
    await reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}
