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
    const [org] = await db.insert(schema.organizations).values({ name }).returning();
    orgId = org.id;
    await db.insert(schema.memberships).values({ userId, orgId, role: "owner" });
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
