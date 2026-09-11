import "server-only";
import { sql } from "drizzle-orm";
import type { Db, Executor } from "@/lib/db/forOrg";
import { asSystem } from "@/lib/db/rls";

/**
 * Right of access / data portability (GDPR art. 15 & 20, PDPL equivalent).
 * Produces a single JSON document containing everything the workspace holds
 * about the user, in a machine-readable form they can take elsewhere.
 */

/** Columns that must never leave the server, per table. OAuth access/refresh
 * tokens are credentials for the user's *other* accounts — exporting them would
 * turn a privacy feature into a way to spill live tokens into a downloads
 * folder. The connection itself is still reported (platform, status, when). */
const REDACTED: Record<string, string[]> = {
  social_connections: ["access_token", "refresh_token"],
};

/** Tables included in the export, with the reason a person would care. */
export const EXPORTED_TABLES = [
  "organizations",
  "memberships",
  "brands",
  "products",
  "target_groups",
  "dna_versions",
  "sources",
  "source_chunks",
  "analyses",
  "ideas",
  "drafts",
  "content_plans",
  "media_assets",
  "assistant_messages",
  "lesson_progress",
  "dismissed_suggestions",
  "social_connections",
  "credit_ledger",
  "coupon_redemptions",
  // Billing history belongs in an export: it is the customer's own financial
  // record of what they paid and what VAT was charged.
  "invoices",
  "link_events",
  "jobs",
] as const;

export type ExportProfile = { id: string; email?: string; metadata?: unknown };

async function selectForOrg(tx: Executor, table: string, orgId: string): Promise<unknown[]> {
  // `organizations` is keyed by id, everything else by org_id.
  const where = table === "organizations" ? sql`id = ${orgId}::uuid` : sql`org_id = ${orgId}::uuid`;
  const rows = await tx.execute(sql`select * from ${sql.identifier(table)} where ${where}`);
  const list = rows as unknown as Record<string, unknown>[];
  const drop = REDACTED[table];
  if (!drop) return list;
  return list.map((r) => {
    const copy = { ...r };
    for (const k of drop) if (k in copy) copy[k] = "[redacted]";
    return copy;
  });
}

/** Build the full export document for one workspace. */
export async function buildExport(db: Db, orgId: string, profile: ExportProfile) {
  const data: Record<string, unknown[]> = {};
  // One system-scoped transaction for the whole export: it reads every table by
  // raw name, which no single org scope covers, and a consistent snapshot is
  // what makes the document internally coherent.
  await asSystem(db, async (tx) => {
    for (const table of EXPORTED_TABLES) {
      data[table] = await selectForOrg(tx, table, orgId);
    }
  });
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      format: "athar-data-export/1",
      organizationId: orgId,
      note:
        "Every record Athar holds for this workspace. OAuth tokens for connected " +
        "social accounts are redacted on purpose: they are credentials, not data about you.",
    },
    account: profile,
    data,
  };
}
