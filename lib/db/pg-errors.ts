/**
 * True when `e` (or its wrapped cause) is a Postgres unique_violation (23505).
 * Drizzle / postgres-js wrap the underlying pg error, so the `23505` code lives
 * on `e.cause.code` rather than `e.code` — checking only `e.code` (as some call
 * sites used to) silently misses the wrapped case and re-throws, which crashed
 * brand-new users whose first concurrent requests race in ensureUserContext.
 */
export function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string }; message?: string } | null | undefined;
  if (!err) return false;
  return err.code === "23505" || err.cause?.code === "23505" || /23505|duplicate key/i.test(err.message ?? "");
}
