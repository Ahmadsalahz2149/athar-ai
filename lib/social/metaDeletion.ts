import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { asSystem } from "@/lib/db/rls";
import { newConfirmationCode } from "./meta-signed-request";
import { log } from "@/lib/log";

/**
 * Honouring Meta's data-deletion and deauthorize callbacks (Phase 6).
 *
 * Meta will not approve an app for publishing permissions without a data
 * deletion callback, so this is a prerequisite for the review rather than a
 * nice-to-have — but it is also just the right behaviour: someone who removes
 * our app from their Facebook account has withdrawn consent, and the tokens we
 * hold are theirs.
 *
 * Deliberately OUTSIDE the forOrg façade, and allowlisted for it. A deletion
 * request identifies a PERSON ON A PLATFORM, who may hold connections in
 * several workspaces or in none, and there is no session and no org to scope
 * to. Every write below is still bounded to rows carrying that one platform
 * user id.
 *
 * What it deletes is exactly the connection: tokens, account ids, the link to
 * the platform. It does NOT delete the customer's drafts, sources or DNA —
 * those are the workspace's own content, authored by them, and are not Meta's
 * to ask about. Erasing a customer's work because a platform user unlinked an
 * account would be its own kind of data loss.
 */

export type DeletionOutcome = { confirmationCode: string; deleted: number };

/**
 * Remove every stored Meta connection for one platform user, and record the
 * request so the status page can answer for it.
 *
 * Idempotent by nature: a repeat request finds nothing left to delete and still
 * returns a code, which is what a platform retrying a webhook needs.
 */
export async function deleteMetaUserData(externalUserId: string): Promise<DeletionOutcome> {
  const confirmationCode = newConfirmationCode();
  if (!db) return { confirmationCode, deleted: 0 };

  const deleted = await asSystem(db, async (tx) => {
    const rows = await tx
      .delete(schema.socialConnections)
      .where(and(
        eq(schema.socialConnections.externalUserId, externalUserId),
        // Only the platforms this app is: a Meta user id must never match a
        // LinkedIn or X row, however unlikely the collision.
        eq(schema.socialConnections.platform, "facebook"),
      ))
      .returning({ id: schema.socialConnections.id });

    const igRows = await tx
      .delete(schema.socialConnections)
      .where(and(
        eq(schema.socialConnections.externalUserId, externalUserId),
        eq(schema.socialConnections.platform, "instagram"),
      ))
      .returning({ id: schema.socialConnections.id });

    const n = rows.length + igRows.length;

    await tx.insert(schema.dataDeletionRequests).values({
      provider: "meta",
      externalUserId,
      confirmationCode,
      status: "completed",
      connectionsDeleted: n,
      completedAt: new Date(),
    });

    return n;
  });

  log.info("meta.data_deleted", { deleted });
  return { confirmationCode, deleted };
}

/**
 * The user removed the app from their Facebook account.
 *
 * Their tokens are dead the moment they do this, so keeping them is keeping
 * something useless and sensitive. Deleting rather than marking revoked: a
 * revoked row still holds an access token, and a token nobody can use is a
 * liability with no upside.
 */
export async function deauthorizeMetaUser(externalUserId: string): Promise<number> {
  if (!db) return 0;
  const n = await asSystem(db, async (tx) => {
    const rows = await tx
      .delete(schema.socialConnections)
      .where(eq(schema.socialConnections.externalUserId, externalUserId))
      .returning({ id: schema.socialConnections.id, platform: schema.socialConnections.platform });
    return rows.filter((r) => r.platform === "facebook" || r.platform === "instagram").length;
  });
  log.info("meta.deauthorized", { removed: n });
  return n;
}

export type DeletionStatus =
  | { found: true; status: string; deleted: number; requestedAt: Date; completedAt: Date | null }
  | { found: false };

/** What to show someone who comes back with their confirmation code. */
export async function deletionStatus(code: string): Promise<DeletionStatus> {
  if (!db || !code) return { found: false };
  const rows = await asSystem(db, (tx) => tx
    .select({
      status: schema.dataDeletionRequests.status,
      deleted: schema.dataDeletionRequests.connectionsDeleted,
      requestedAt: schema.dataDeletionRequests.createdAt,
      completedAt: schema.dataDeletionRequests.completedAt,
    })
    .from(schema.dataDeletionRequests)
    .where(eq(schema.dataDeletionRequests.confirmationCode, code.trim().toUpperCase()))
    .limit(1));

  const r = rows[0];
  return r ? { found: true, ...r } : { found: false };
}
