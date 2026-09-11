import "server-only";
import { eq, and, ne, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/forOrg";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { removePublicObject } from "@/lib/storage/uploads";
import { log } from "@/lib/log";
import { asSystem, rlsEnabled, setSystemScope } from "@/lib/db/rls";

/**
 * Right to erasure (GDPR art. 17 / PDPL). Deletes everything belonging to a
 * user: their workspace data, their membership, their stored files, and the
 * auth account itself.
 *
 * Two shapes, decided by whether anyone else is in the workspace:
 *  - Sole member  → the whole organization is wiped (today's invariant: the
 *    `memberships_user_uq` index means one workspace per user).
 *  - Others remain → only this user's membership and auth account go; the
 *    workspace and its content belong to the people still in it.
 *
 * The data wipe runs in ONE transaction: a partial erasure that left some
 * tables behind would be both a broken account and a standing privacy breach.
 */
export type EraseResult = {
  ok: boolean;
  orgDeleted: boolean;
  deleted: Record<string, number>;
  authDeleted: boolean;
  error?: string;
};

/**
 * Every table carrying an `org_id`, ordered so foreign keys are respected
 * (children before parents). Missing one here would silently orphan personal
 * data, so the erasure test asserts this list matches the live schema exactly.
 */
export const ORG_SCOPED_TABLES = [
  // children first
  "source_chunks",
  "drafts",
  "sources",
  "dna_versions",
  // flat, no inbound foreign keys
  "analyses",
  "assistant_messages",
  "content_plans",
  "coupon_redemptions",
  "dismissed_suggestions",
  "ideas",
  // Our local projection of the Stripe invoices. Deleting it is safe against
  // the tax-retention obligation that would otherwise conflict with erasure:
  // Stripe remains the system of record for the issued documents, so the
  // statutory copy survives while the personal data leaves this database.
  "invoices",
  "jobs",
  "lesson_progress",
  "link_events",
  "media_assets",
  "products",
  "social_connections",
  "target_groups",
  // parents last
  "brands",
  "credit_ledger",
  // membership is org-scoped too, and must go before the organization itself
  "memberships",
] as const;

/** Wipe every row belonging to `orgId`, then the org itself. Transactional: a
 * partial erasure would be both a broken account and a standing breach. */
export async function eraseOrgData(db: Db, orgId: string): Promise<Record<string, number>> {
  const deleted: Record<string, number> = {};
  await db.transaction(async (tx) => {
    // Erasure deletes the organization row ITSELF, which no org scope can
    // express — a scope that still saw the org would not be an erasure.
    if (rlsEnabled()) await setSystemScope(tx);
    for (const name of ORG_SCOPED_TABLES) {
      // Table names come from the constant list above (never user input) and
      // are quoted as identifiers; the org id is bound as a parameter.
      const rows = await tx.execute(
        sql`delete from ${sql.identifier(name)} where org_id = ${orgId}::uuid returning id`,
      );
      deleted[name] = (rows as unknown as unknown[]).length;
    }
    const o = await tx.execute(
      sql`delete from ${sql.identifier("organizations")} where id = ${orgId}::uuid returning id`,
    );
    deleted["organizations"] = (o as unknown as unknown[]).length;
  });
  return deleted;
}

/** True when somebody other than `userId` still belongs to the org. */
async function hasOtherMembers(db: Db, orgId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.memberships.id })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.orgId, orgId), ne(schema.memberships.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

/** Best-effort removal of files the workspace put in the public bucket. Storage
 * failures must not block the database erasure — the personal data is the row. */
async function eraseBrandAssets(db: Db, orgId: string): Promise<void> {
  try {
    const brands = await db
      .select({ id: schema.brands.id, logoUrl: schema.brands.logoUrl })
      .from(schema.brands)
      .where(eq(schema.brands.orgId, orgId));
    for (const b of brands) {
      if (!b.logoUrl || b.logoUrl.startsWith("data:")) continue;
      for (const ext of ["png", "jpeg", "webp", "gif"]) {
        await removePublicObject(`logos/${b.id}.${ext}`).catch(() => {});
      }
    }
  } catch {
    /* best-effort */
  }
}

/**
 * Erase a user. `orgId` is the caller's own workspace, resolved server-side —
 * never taken from the client.
 */
export async function eraseAccount(db: Db, orgId: string, userId: string): Promise<EraseResult> {
  let deleted: Record<string, number> = {};
  let orgDeleted = false;
  try {
    if (await hasOtherMembers(db, orgId, userId)) {
      // Shared workspace: remove only this person's link to it.
      const m = await db
        .delete(schema.memberships)
        .where(and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.userId, userId)))
        .returning({ id: schema.memberships.id });
      deleted = { memberships: m.length };
    } else {
      await eraseBrandAssets(db, orgId);
      deleted = await eraseOrgData(db, orgId);
      orgDeleted = (deleted["organizations"] ?? 0) > 0;
    }
    // Platform-admin grants are keyed by user, not org.
    await asSystem(db, (tx) => tx.delete(schema.platformAdmins).where(eq(schema.platformAdmins.userId, userId)));
  } catch (e) {
    log.error("gdpr.erase_failed", { orgId }, e);
    return { ok: false, orgDeleted: false, deleted, authDeleted: false, error: "erase_failed" };
  }

  // Finally the auth account. Done last: if this failed first, the user would
  // be locked out while their data lived on.
  let authDeleted = false;
  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    authDeleted = !error;
    if (error) log.error("gdpr.auth_delete_failed", { userId }, error);
  }
  return { ok: true, orgDeleted, deleted, authDeleted };
}
