import { describe, it, expect } from "vitest";
import { readCapped } from "@/lib/http/readCapped";

/**
 * The byte cap is the only thing standing between a hostile or broken upstream
 * and the server's memory. It has to hold when the upstream lies about the
 * size, and when it declares no size at all.
 */
function streamed(chunks: Uint8Array[], headers: Record<string, string> = {}): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
  return new Response(body, { headers });
}

const kb = (n: number) => new Uint8Array(n * 1024).fill(1);

describe("readCapped", () => {
  it("returns a body that fits, intact", async () => {
    const out = await readCapped(streamed([kb(1), kb(2)]), 1024 * 1024);
    expect(out.byteLength).toBe(3 * 1024);
    expect(out[0]).toBe(1);
    expect(out[out.length - 1]).toBe(1);
  });

  it("rejects on the declared length before reading a single byte", async () => {
    const res = streamed([kb(1)], { "content-length": String(50 * 1024 * 1024) });
    await expect(readCapped(res, 1024 * 1024)).rejects.toThrow(/too large/i);
  });

  // The case that makes buffering-then-checking useless: no declared length,
  // and a body far bigger than the cap. It must stop mid-stream.
  it("stops mid-stream when the upstream declares nothing and sends too much", async () => {
    let produced = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        produced += 1;
        controller.enqueue(kb(64));
      },
    });
    await expect(readCapped(new Response(body), 256 * 1024)).rejects.toThrow(/too large/i);
    // Proof it did not drain the whole (endless) stream: only a few chunks were
    // ever asked for.
    expect(produced).toBeLessThan(10);
  });

  it("accepts a body exactly at the cap, and rejects one byte more", async () => {
    await expect(readCapped(streamed([kb(4)]), 4 * 1024)).resolves.toHaveLength(4 * 1024);
    await expect(readCapped(streamed([kb(4), new Uint8Array(1)]), 4 * 1024)).rejects.toThrow(/too large/i);
  });

  it("handles an empty body", async () => {
    expect(await readCapped(new Response(null), 1024)).toHaveLength(0);
  });
});
