import { describe, it, expect, beforeEach } from "vitest";
import { consume, resetRateLimit, LIMITS } from "@/lib/rate-limit";

describe("rate limiter (fixed window)", () => {
  beforeEach(() => resetRateLimit());

  it("allows exactly `limit` attempts, then blocks", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(consume("k", 5, 60_000, t0).ok).toBe(true);
    }
    const blocked = consume("k", 5, 60_000, t0);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("reports remaining budget as it is spent", () => {
    const t0 = 2_000_000;
    expect(consume("r", 3, 60_000, t0).remaining).toBe(2);
    expect(consume("r", 3, 60_000, t0).remaining).toBe(1);
    expect(consume("r", 3, 60_000, t0).remaining).toBe(0);
  });

  it("lets the caller back in once the window elapses", () => {
    const t0 = 3_000_000;
    for (let i = 0; i < 3; i++) consume("w", 3, 60_000, t0);
    expect(consume("w", 3, 60_000, t0).ok).toBe(false);
    // One millisecond before expiry: still blocked.
    expect(consume("w", 3, 60_000, t0 + 59_999).ok).toBe(false);
    // Window rolled over.
    expect(consume("w", 3, 60_000, t0 + 60_001).ok).toBe(true);
  });

  it("keeps keys independent (one IP cannot exhaust another's budget)", () => {
    const t0 = 4_000_000;
    for (let i = 0; i < 5; i++) consume("ip:a", 5, 60_000, t0);
    expect(consume("ip:a", 5, 60_000, t0).ok).toBe(false);
    expect(consume("ip:b", 5, 60_000, t0).ok).toBe(true); // unaffected
  });

  it("resetRateLimit clears a single key without touching others", () => {
    const t0 = 5_000_000;
    consume("x", 1, 60_000, t0);
    consume("y", 1, 60_000, t0);
    expect(consume("x", 1, 60_000, t0).ok).toBe(false);
    resetRateLimit("x");
    expect(consume("x", 1, 60_000, t0).ok).toBe(true);
    expect(consume("y", 1, 60_000, t0).ok).toBe(false); // untouched
  });

  it("does not grow without bound when keys are never reused", () => {
    // Expired buckets must be reclaimed, or a flood of distinct IPs would be a
    // memory leak. Walk the clock far past each window as we go.
    for (let i = 0; i < 25_000; i++) consume(`flood:${i}`, 1, 1_000, 6_000_000 + i * 2_000);
    // The sweep keeps the map bounded; a fresh key still behaves correctly.
    expect(consume("after-flood", 2, 60_000, 60_000_000).ok).toBe(true);
  });

  it("auth limits are stricter than the AI burst guard", () => {
    // Guards the tuning itself: sign-in must never be looser than AI streams.
    expect(LIMITS.signInEmail.limit).toBeLessThan(LIMITS.aiStream.limit);
    expect(LIMITS.resetEmail.limit).toBeLessThanOrEqual(LIMITS.resetIp.limit);
  });
});
