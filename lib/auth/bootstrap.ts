import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { isUniqueViolation } from "@/lib/db/pg-errors";
import { START_GRANT } from "@/lib/credits/costs";
import { asSystem } from "@/lib/db/rls";

/**
 * Ensure a signed-in user has an organization + brand (single-brand MVP).
 * Idempotent — safe to call on every authenticated request.
 */
export async function ensureUserContext(
  userId: string,
  displayName?: string,
): Promise<{ orgId: string; brandId: string } | null> {
  if (!db) return null;
  const name = displayName?.trim() || "workspace";

  // Every read here is system-scoped, and each is its OWN transaction on
  // purpose: the recovery below depends on an INSERT failing, and a failed
  // statement aborts the transaction it is in — one enclosing transaction would
  // turn the losing side of the bootstrap race into a hard error instead of the
  // adopt-the-winner path it is.
  const membership = await asSystem(db, (tx) => tx
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, userId))
    .limit(1));

  let orgId: string;
  if (membership.length) {
    orgId = membership[0].orgId;
  } else {
    // Concurrent first-requests both reach here. The unique index on
    // memberships.user_id lets exactly one win; the loser drops the org it just
    // created and adopts the winner's, so a user never ends up with two orgs.
    const [org] = await asSystem(db, (tx) => tx.insert(schema.organizations).values({ name }).returning());
    try {
      await asSystem(db, (tx) => tx.insert(schema.memberships).values({ userId, orgId: org.id, role: "owner" }));
      orgId = org.id;
    } catch (e) {
      // Drizzle wraps the pg error, so match 23505 through the cause chain — a
      // plain `e.code` check misses it and crashes the user's first page load.
      if (!isUniqueViolation(e)) throw e;
      await asSystem(db, (tx) => tx.delete(schema.organizations).where(eq(schema.organizations.id, org.id)));
      const winner = await asSystem(db, (tx) => tx
        .select()
        .from(schema.memberships)
        .where(eq(schema.memberships.userId, userId))
        .limit(1));
      if (!winner.length) throw e;
      orgId = winner[0].orgId;
    }
  }

  // One-time welcome grant so any org (including ones created before credits
  // existed) can generate immediately (ADR-004). Idempotent — granted once ever.
  await forOrg(db, orgId).grantOnce(START_GRANT, "signup_grant");

  const brandRows = await asSystem(db, (tx) => tx
    .select()
    .from(schema.brands)
    .where(eq(schema.brands.orgId, orgId))
    .limit(1));

  let brandId: string;
  if (brandRows.length) {
    brandId = brandRows[0].id;
  } else {
    const [brand] = await asSystem(db, (tx) => tx.insert(schema.brands).values({ orgId, name }).returning());
    brandId = brand.id;
  }

  return { orgId, brandId };
}
