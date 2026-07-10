import { and, desc, eq, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import type { ContentDna } from "@/lib/ai/prompts";

/**
 * Tenancy façade (ADR-005). ALL tenant-table access must go through forOrg(db, orgId):
 * every query is scoped to `orgId`, and every write first verifies the target brand
 * belongs to this org. This is the enforceable boundary that the CI tenancy test
 * (tests/tenancy.test.ts) proves. Do not call raw db.select()/insert() on tenant
 * tables (organizations/brands/dna_versions/drafts) outside this file.
 */
export type Db = PostgresJsDatabase<typeof schema>;

export function forOrg(db: Db, orgId: string) {
  async function assertBrand(brandId: string) {
    const rows = await db
      .select()
      .from(schema.brands)
      .where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId)))
      .limit(1);
    if (!rows.length) throw new Error("Tenancy violation: brand does not belong to this org");
    return rows[0];
  }

  return {
    async currentBrand() {
      const rows = await db
        .select()
        .from(schema.brands)
        .where(and(eq(schema.brands.orgId, orgId), isNull(schema.brands.deletedAt)))
        .limit(1);
      return rows[0] ?? null;
    },

    async saveDna(brandId: string, dna: ContentDna): Promise<string> {
      await assertBrand(brandId);
      const last = await db
        .select({ v: schema.dnaVersions.version })
        .from(schema.dnaVersions)
        .where(and(eq(schema.dnaVersions.orgId, orgId), eq(schema.dnaVersions.brandId, brandId)))
        .orderBy(desc(schema.dnaVersions.version))
        .limit(1);
      const version = (last[0]?.v ?? 0) + 1;
      const [row] = await db
        .insert(schema.dnaVersions)
        .values({ orgId, brandId, version, payload: dna, completionPct: dna.completion_pct ?? 0 })
        .returning();
      await db
        .update(schema.brands)
        .set({ currentDnaVersionId: row.id })
        .where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId)));
      return row.id;
    },

    async currentDna(brandId: string): Promise<ContentDna | null> {
      const b = await db
        .select()
        .from(schema.brands)
        .where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId)))
        .limit(1);
      if (!b.length || !b[0].currentDnaVersionId) return null;
      const rows = await db
        .select()
        .from(schema.dnaVersions)
        .where(and(eq(schema.dnaVersions.id, b[0].currentDnaVersionId), eq(schema.dnaVersions.orgId, orgId)))
        .limit(1);
      return rows.length ? (rows[0].payload as ContentDna) : null;
    },

    async saveDraft(
      brandId: string,
      d: { platform: string; topic?: string; hook: string; body: string; dnaVersionId?: string | null },
    ): Promise<string> {
      await assertBrand(brandId);
      const [row] = await db
        .insert(schema.drafts)
        .values({
          orgId,
          brandId,
          dnaVersionId: d.dnaVersionId ?? null,
          platform: d.platform,
          topic: d.topic ?? null,
          hook: d.hook,
          body: d.body,
        })
        .returning();
      return row.id;
    },

    async listDrafts(brandId: string, limit = 20) {
      return db
        .select()
        .from(schema.drafts)
        .where(
          and(
            eq(schema.drafts.orgId, orgId),
            eq(schema.drafts.brandId, brandId),
            isNull(schema.drafts.deletedAt),
          ),
        )
        .orderBy(desc(schema.drafts.createdAt))
        .limit(limit);
    },
  };
}
