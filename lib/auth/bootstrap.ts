import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { START_GRANT } from "@/lib/credits/costs";

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

  const membership = await db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, userId))
    .limit(1);

  let orgId: string;
  if (membership.length) {
    orgId = membership[0].orgId;
  } else {
    // Concurrent first-requests both reach here. The unique index on
    // memberships.user_id lets exactly one win; the loser drops the org it just
    // created and adopts the winner's, so a user never ends up with two orgs.
    const [org] = await db.insert(schema.organizations).values({ name }).returning();
    try {
      await db.insert(schema.memberships).values({ userId, orgId: org.id, role: "owner" });
      orgId = org.id;
    } catch (e) {
      if ((e as { code?: string })?.code !== "23505") throw e;
      await db.delete(schema.organizations).where(eq(schema.organizations.id, org.id));
      const winner = await db
        .select()
        .from(schema.memberships)
        .where(eq(schema.memberships.userId, userId))
        .limit(1);
      if (!winner.length) throw e;
      orgId = winner[0].orgId;
    }
  }

  // One-time welcome grant so any org (including ones created before credits
  // existed) can generate immediately (ADR-004). Idempotent — granted once ever.
  await forOrg(db, orgId).grantOnce(START_GRANT, "signup_grant");

  const brandRows = await db
    .select()
    .from(schema.brands)
    .where(eq(schema.brands.orgId, orgId))
    .limit(1);

  let brandId: string;
  if (brandRows.length) {
    brandId = brandRows[0].id;
  } else {
    const [brand] = await db.insert(schema.brands).values({ orgId, name }).returning();
    brandId = brand.id;
  }

  return { orgId, brandId };
}
