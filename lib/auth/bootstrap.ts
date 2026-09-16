import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { isUniqueViolation } from "@/lib/db/pg-errors";
import { START_GRANT } from "@/lib/credits/costs";
import { asSystem } from "@/lib/db/rls";
import { asRole, type Role } from "./roles";

/**
 * Ensure a signed-in user has an organization + brand (single-brand MVP).
 * Idempotent — safe to call on every authenticated request.
 */
export async function ensureUserContext(
  userId: string,
  displayName?: string,
): Promise<{ orgId: string; brandId: string; role: Role } | null> {
  if (!db) return null;
  const name = displayName?.trim() || "workspace";
  // The caller passes the signed-in address; it names the workspace AND gets
  // recorded on the seat so the team screen can show who holds it.
  const email = displayName?.trim().toLowerCase() || null;

  // Every read here is system-scoped, and each is its OWN transaction on
  // purpose: the recovery below depends on an INSERT failing, and a failed
  // statement aborts the transaction it is in — one enclosing transaction would
  // turn the losing side of the bootstrap race into a hard error instead of the
  // adopt-the-winner path it is.
  //
  // Since Phase 4 a user can hold several seats: their own workspace and any
  // they were invited into. The one they OWN comes first, so an agency's writer
  // still lands in their own workspace by default; someone who was only ever
  // invited lands in the workspace that invited them, and no empty second
  // workspace is created behind their back.
  const membership = await asSystem(db, (tx) => tx
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, userId))
    .orderBy(sql`case when ${schema.memberships.role} = 'owner' then 0 else 1 end`, schema.memberships.createdAt));

  let orgId: string;
  let role: Role = "owner";
  if (membership.length) {
    orgId = membership[0].orgId;
    role = asRole(membership[0].role);
  } else {
    // Reached only when the user has no seat anywhere. Concurrent
    // first-requests both arrive here; `memberships_owner_uq` — unique on
    // user_id WHERE role = 'owner' — lets exactly one win, and the loser drops
    // the org it just created and adopts the winner's, so a user never ends up
    // owning two workspaces. The index is partial precisely so that being
    // invited into someone else's workspace does not trip it.
    const [org] = await asSystem(db, (tx) => tx.insert(schema.organizations).values({ name }).returning());
    try {
      await asSystem(db, (tx) => tx.insert(schema.memberships).values({ userId, orgId: org.id, role: "owner", email }));
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
      role = asRole(winner[0].role);
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

  return { orgId, brandId, role };
}
