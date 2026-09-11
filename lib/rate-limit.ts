/**
 * In-process fixed-window rate limiter (pure, no I/O — unit-testable).
 *
 * Before this, the only limits on auth and AI endpoints were the credit balance
 * and Supabase's own defaults; the password-reset cooldown lived in the browser
 * and was trivially bypassed by calling the server action directly.
 *
 * Scope, stated honestly: counters live in this process's memory, so they reset
 * on restart and are not shared if the host ever runs more than one Node
 * process. That still stops the case that matters here — a burst of automated
 * attempts from one source — with zero operational cost (no Redis, no table, no
 * migration to run on production). Move to a shared store when the app scales
 * past a single process.
 */
export type RateVerdict = { ok: boolean; retryAfterMs: number; remaining: number };

type Bucket = { hits: number; resetAt: number };

const buckets = new Map<string, Bucket>();
/** Hard cap so a flood of distinct keys can't grow the map without bound. */
const MAX_KEYS = 20_000;

/** Drop expired buckets. Called on each consume — O(n) only once the map is
 * large, which is exactly when it needs trimming. */
function sweep(now: number): void {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  if (buckets.size > MAX_KEYS) {
    // Still oversized after expiry: drop the oldest-resetting keys.
    const sorted = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (const [k] of sorted.slice(0, buckets.size - MAX_KEYS)) buckets.delete(k);
  }
}

/**
 * Count one attempt against `key`. Returns ok:false once `limit` is exceeded
 * inside `windowMs`, with how long to wait.
 */
export function consume(key: string, limit: number, windowMs: number, now = Date.now()): RateVerdict {
  if (buckets.size > MAX_KEYS / 2) sweep(now);

  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { hits: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0, remaining: limit - 1 };
  }
  b.hits += 1;
  if (b.hits > limit) return { ok: false, retryAfterMs: b.resetAt - now, remaining: 0 };
  return { ok: true, retryAfterMs: 0, remaining: limit - b.hits };
}

/** Test/ops helper: forget a key (or everything). */
export function resetRateLimit(key?: string): void {
  if (key === undefined) buckets.clear();
  else buckets.delete(key);
}

/** Tuned limits. Auth is deliberately strict; AI calls also cost credits, so the
 * limit there is a burst guard rather than the primary control. */
export const LIMITS = {
  /** Sign-in per IP: normal humans retype a password a handful of times. */
  signInIp: { limit: 10, windowMs: 5 * 60_000 },
  /** Sign-in per email: blunts a targeted brute force that rotates IPs. */
  signInEmail: { limit: 5, windowMs: 15 * 60_000 },
  /** Sign-up per IP: stops scripted account farming. */
  signUpIp: { limit: 5, windowMs: 60 * 60_000 },
  /** Password reset: sending mail to an address the caller may not own. */
  resetIp: { limit: 5, windowMs: 60 * 60_000 },
  resetEmail: { limit: 3, windowMs: 60 * 60_000 },
  /** AI streams, per org — a burst guard in front of the provider. */
  aiStream: { limit: 20, windowMs: 60_000 },
  /**
   * Public link page, per IP. These are the only writes in the product that an
   * unauthenticated stranger can trigger: every page view and every click
   * records a row. Unthrottled, a loop inflates the owner's analytics into
   * fiction and grows the table without bound, for free.
   *
   * The numbers are set so a real visitor never notices — nobody opens the same
   * link page 30 times a minute, or clicks 60 times — while a script is capped
   * within seconds.
   */
  linkView: { limit: 30, windowMs: 60_000 },
  linkClick: { limit: 60, windowMs: 60_000 },
} as const;
