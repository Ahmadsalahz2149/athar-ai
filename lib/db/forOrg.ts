import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import type { ContentDna } from "@/lib/ai/prompts";

/**
 * Tenancy façade (ADR-005). ALL tenant-table access must go through forOrg(db, orgId):
 * every query is scoped to `orgId`, and every write first verifies the target brand
 * belongs to this org. This is the enforceable boundary that the CI tenancy test
 * (tests/tenancy.test.ts) proves. Do not call raw db.select()/insert() on tenant
 * tables (organizations/brands/dna_versions/drafts/credit_ledger) outside this file.
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

  async function appendLedger(delta: number, reason: string, refType?: string, refId?: string): Promise<number> {
    const rows = await db
      .select({ d: schema.creditLedger.delta })
      .from(schema.creditLedger)
      .where(eq(schema.creditLedger.orgId, orgId));
    const balanceAfter = rows.reduce((s, r) => s + r.d, 0) + delta;
    await db.insert(schema.creditLedger).values({
      orgId,
      delta,
      reason,
      refType: refType ?? null,
      refId: refId ?? null,
      balanceAfter,
    });
    return balanceAfter;
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

    // --- Credits (append-only ledger; balance = sum of deltas) ---
    async balance(): Promise<number> {
      const rows = await db
        .select({ d: schema.creditLedger.delta })
        .from(schema.creditLedger)
        .where(eq(schema.creditLedger.orgId, orgId));
      return rows.reduce((s, r) => s + r.d, 0);
    },

    async grant(amount: number, reason: string): Promise<number> {
      return appendLedger(Math.abs(amount), reason);
    },

    // Idempotent grant keyed on `reason` — grants once per org, ever. Safe to call
    // on every login to back-fill orgs created before credits existed. The DB
    // partial-unique index on signup_grant is the real guard: the pre-check is a
    // fast path, and a lost race surfaces as a unique violation we swallow.
    async grantOnce(amount: number, reason: string): Promise<number> {
      const currentBalance = async () => {
        const rows = await db
          .select({ d: schema.creditLedger.delta })
          .from(schema.creditLedger)
          .where(eq(schema.creditLedger.orgId, orgId));
        return rows.reduce((s, r) => s + r.d, 0);
      };
      const existing = await db
        .select({ id: schema.creditLedger.id })
        .from(schema.creditLedger)
        .where(and(eq(schema.creditLedger.orgId, orgId), eq(schema.creditLedger.reason, reason)))
        .limit(1);
      if (existing.length) return currentBalance();
      try {
        return await appendLedger(Math.abs(amount), reason);
      } catch (e) {
        // 23505 = unique_violation: a concurrent login already granted it.
        if ((e as { code?: string })?.code === "23505") return currentBalance();
        throw e;
      }
    },

    async debit(amount: number, reason: string, refType?: string, refId?: string): Promise<number> {
      return appendLedger(-Math.abs(amount), reason, refType, refId);
    },

    // --- Sources & retrieval (pgvector; org + brand scoped) ---
    async saveSource(
      brandId: string,
      s: { kind?: string; title?: string | null; status?: string },
    ): Promise<string> {
      await assertBrand(brandId);
      const [row] = await db
        .insert(schema.sources)
        .values({
          orgId,
          brandId,
          kind: s.kind ?? "text",
          title: s.title ?? null,
          status: s.status ?? "ready",
        })
        .returning();
      return row.id;
    },

    async saveChunks(
      brandId: string,
      sourceId: string,
      items: { idx: number; content: string; embedding: number[]; tokens?: number }[],
    ): Promise<number> {
      await assertBrand(brandId);
      if (!items.length) return 0;
      await db.insert(schema.sourceChunks).values(
        items.map((it) => ({
          orgId,
          brandId,
          sourceId,
          idx: it.idx,
          content: it.content,
          tokens: it.tokens ?? null,
          embedding: it.embedding,
        })),
      );
      return items.length;
    },

    /** Cosine-nearest chunks for a query embedding, scoped to this org + brand. */
    async retrieve(
      brandId: string,
      queryEmbedding: number[],
      k = 6,
    ): Promise<{ content: string; sourceId: string; distance: number }[]> {
      const vec = `[${queryEmbedding.join(",")}]`;
      const distance = sql<number>`${schema.sourceChunks.embedding} <=> ${vec}::vector`;
      return db
        .select({
          content: schema.sourceChunks.content,
          sourceId: schema.sourceChunks.sourceId,
          distance,
        })
        .from(schema.sourceChunks)
        .where(and(eq(schema.sourceChunks.orgId, orgId), eq(schema.sourceChunks.brandId, brandId)))
        .orderBy(distance)
        .limit(k);
    },

    async countChunks(brandId: string): Promise<number> {
      const rows = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.sourceChunks)
        .where(and(eq(schema.sourceChunks.orgId, orgId), eq(schema.sourceChunks.brandId, brandId)));
      return rows[0]?.n ?? 0;
    },
  };
}
