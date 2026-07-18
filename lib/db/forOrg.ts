import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import type { ContentDna } from "@/lib/ai/prompts";
import { normalizeDna } from "@/lib/ai/normalize";

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
      // Normalize on read so DNA stored before newer fields existed (pillars,
      // meters, …) always comes back well-shaped and never crashes a screen.
      return rows.length ? normalizeDna(rows[0].payload) : null;
    },

    /** Version metadata for the current DNA: which version, when it was built,
     * and how many versions exist (for the "version N · updated …" line). */
    async dnaMeta(brandId: string): Promise<{ version: number; createdAt: Date; count: number } | null> {
      const b = await db
        .select({ cur: schema.brands.currentDnaVersionId })
        .from(schema.brands)
        .where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId)))
        .limit(1);
      if (!b.length || !b[0].cur) return null;
      const rows = await db
        .select({ version: schema.dnaVersions.version, createdAt: schema.dnaVersions.createdAt })
        .from(schema.dnaVersions)
        .where(and(eq(schema.dnaVersions.id, b[0].cur), eq(schema.dnaVersions.orgId, orgId)))
        .limit(1);
      if (!rows.length) return null;
      const all = await db
        .select({ v: schema.dnaVersions.version })
        .from(schema.dnaVersions)
        .where(and(eq(schema.dnaVersions.orgId, orgId), eq(schema.dnaVersions.brandId, brandId)));
      return { version: rows[0].version, createdAt: rows[0].createdAt, count: all.length };
    },

    async saveDraft(
      brandId: string,
      d: {
        platform: string;
        topic?: string;
        hook: string;
        body: string;
        dnaVersionId?: string | null;
        postScore?: number;
        dnaMatch?: number;
        ideaId?: string | null;
      },
    ): Promise<string> {
      await assertBrand(brandId);
      const [row] = await db
        .insert(schema.drafts)
        .values({
          orgId,
          brandId,
          dnaVersionId: d.dnaVersionId ?? null,
          ideaId: d.ideaId ?? null,
          platform: d.platform,
          topic: d.topic ?? null,
          hook: d.hook,
          body: d.body,
          postScore: d.postScore ?? 0,
          dnaMatch: d.dnaMatch ?? 0,
        })
        .returning();
      return row.id;
    },

    async setDraftSource(brandId: string, draftId: string, sourceId: string): Promise<void> {
      await db
        .update(schema.drafts)
        .set({ sourceId })
        .where(
          and(
            eq(schema.drafts.id, draftId),
            eq(schema.drafts.orgId, orgId),
            eq(schema.drafts.brandId, brandId),
          ),
        );
    },

    async reviewDraft(brandId: string, draftId: string, status: string, note: string): Promise<void> {
      await db
        .update(schema.drafts)
        .set({ status, reviewNote: note || null })
        .where(
          and(
            eq(schema.drafts.id, draftId),
            eq(schema.drafts.orgId, orgId),
            eq(schema.drafts.brandId, brandId),
          ),
        );
    },

    async setDraftStatus(brandId: string, draftId: string, status: string, scheduledAt?: Date): Promise<void> {
      await db
        .update(schema.drafts)
        .set(scheduledAt ? { status, scheduledAt } : { status })
        .where(
          and(
            eq(schema.drafts.id, draftId),
            eq(schema.drafts.orgId, orgId),
            eq(schema.drafts.brandId, brandId),
          ),
        );
    },

    async listDraftsByStatus(brandId: string, status?: string) {
      const conds = [
        eq(schema.drafts.orgId, orgId),
        eq(schema.drafts.brandId, brandId),
        isNull(schema.drafts.deletedAt),
      ];
      if (status) conds.push(eq(schema.drafts.status, status));
      return db
        .select()
        .from(schema.drafts)
        .where(and(...conds))
        .orderBy(desc(schema.drafts.createdAt))
        .limit(100);
    },

    async scheduledDrafts(brandId: string) {
      return db
        .select()
        .from(schema.drafts)
        .where(
          and(
            eq(schema.drafts.orgId, orgId),
            eq(schema.drafts.brandId, brandId),
            eq(schema.drafts.status, "scheduled"),
            isNull(schema.drafts.deletedAt),
          ),
        );
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
      s: { kind?: string; title?: string | null; status?: string; language?: string | null; category?: string | null },
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
          language: s.language ?? null,
          category: s.category ?? null,
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

    /** Sources for the brand, each with its chunk count + analyzed flag. */
    async listSources(brandId: string) {
      const rows = await db
        .select()
        .from(schema.sources)
        .where(
          and(
            eq(schema.sources.orgId, orgId),
            eq(schema.sources.brandId, brandId),
            isNull(schema.sources.deletedAt),
          ),
        )
        .orderBy(desc(schema.sources.createdAt));
      const [counts, ideaCounts, draftCounts, analyzed] = await Promise.all([
        db
          .select({ sourceId: schema.sourceChunks.sourceId, n: sql<number>`count(*)::int` })
          .from(schema.sourceChunks)
          .where(and(eq(schema.sourceChunks.orgId, orgId), eq(schema.sourceChunks.brandId, brandId)))
          .groupBy(schema.sourceChunks.sourceId),
        db
          .select({ sourceId: schema.ideas.sourceId, n: sql<number>`count(*)::int` })
          .from(schema.ideas)
          .where(and(eq(schema.ideas.orgId, orgId), eq(schema.ideas.brandId, brandId)))
          .groupBy(schema.ideas.sourceId),
        db
          .select({ sourceId: schema.drafts.sourceId, n: sql<number>`count(*)::int` })
          .from(schema.drafts)
          .where(and(eq(schema.drafts.orgId, orgId), eq(schema.drafts.brandId, brandId)))
          .groupBy(schema.drafts.sourceId),
        db
          .select({ sourceId: schema.analyses.sourceId, summary: schema.analyses.summary })
          .from(schema.analyses)
          .where(and(eq(schema.analyses.orgId, orgId), eq(schema.analyses.brandId, brandId))),
      ]);
      const cmap = new Map(counts.map((c) => [c.sourceId, c.n]));
      const imap = new Map(ideaCounts.filter((c) => c.sourceId).map((c) => [c.sourceId as string, c.n]));
      const dmap = new Map(draftCounts.filter((c) => c.sourceId).map((c) => [c.sourceId as string, c.n]));
      const amap = new Map(analyzed.map((a) => [a.sourceId, a.summary]));
      return rows.map((r) => ({
        ...r,
        chunks: cmap.get(r.id) ?? 0,
        ideas: imap.get(r.id) ?? 0,
        drafts: dmap.get(r.id) ?? 0,
        analyzed: amap.has(r.id),
        summary: amap.get(r.id) ?? null,
      }));
    },

    async deleteSource(brandId: string, sourceId: string): Promise<void> {
      // Soft-delete the source; hard-remove its chunks/analysis so it leaves
      // retrieval + the vault immediately (tenancy-scoped).
      await assertBrand(brandId);
      await db
        .update(schema.sources)
        .set({ deletedAt: new Date() })
        .where(and(eq(schema.sources.id, sourceId), eq(schema.sources.orgId, orgId), eq(schema.sources.brandId, brandId)));
      await db.delete(schema.sourceChunks).where(and(eq(schema.sourceChunks.orgId, orgId), eq(schema.sourceChunks.sourceId, sourceId)));
      await db.delete(schema.analyses).where(and(eq(schema.analyses.orgId, orgId), eq(schema.analyses.sourceId, sourceId)));
    },

    async getSource(brandId: string, sourceId: string) {
      const rows = await db
        .select()
        .from(schema.sources)
        .where(
          and(
            eq(schema.sources.id, sourceId),
            eq(schema.sources.orgId, orgId),
            eq(schema.sources.brandId, brandId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },

    async sourceChunkTexts(brandId: string, sourceId: string, limit = 40): Promise<string[]> {
      const rows = await db
        .select({ content: schema.sourceChunks.content })
        .from(schema.sourceChunks)
        .where(
          and(
            eq(schema.sourceChunks.orgId, orgId),
            eq(schema.sourceChunks.brandId, brandId),
            eq(schema.sourceChunks.sourceId, sourceId),
          ),
        )
        .orderBy(schema.sourceChunks.idx)
        .limit(limit);
      return rows.map((r) => r.content);
    },

    async getAnalysis(brandId: string, sourceId: string) {
      const rows = await db
        .select()
        .from(schema.analyses)
        .where(
          and(
            eq(schema.analyses.orgId, orgId),
            eq(schema.analyses.brandId, brandId),
            eq(schema.analyses.sourceId, sourceId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },

    async saveAnalysis(
      brandId: string,
      sourceId: string,
      a: { summary: string; keyIdeas: unknown; quotes: unknown; audience?: unknown; opportunities?: unknown },
    ): Promise<void> {
      await assertBrand(brandId);
      await db
        .delete(schema.analyses)
        .where(
          and(
            eq(schema.analyses.orgId, orgId),
            eq(schema.analyses.brandId, brandId),
            eq(schema.analyses.sourceId, sourceId),
          ),
        );
      await db.insert(schema.analyses).values({
        orgId,
        brandId,
        sourceId,
        summary: a.summary,
        keyIdeas: a.keyIdeas,
        quotes: a.quotes,
        audience: a.audience ?? null,
        opportunities: a.opportunities ?? null,
      });
    },

    // --- Ideas (used from Phase 3) ---
    async listIdeas(brandId: string, opts?: { status?: string; limit?: number }) {
      const conds = [
        eq(schema.ideas.orgId, orgId),
        eq(schema.ideas.brandId, brandId),
        isNull(schema.ideas.deletedAt),
      ];
      if (opts?.status) conds.push(eq(schema.ideas.status, opts.status));
      return db
        .select()
        .from(schema.ideas)
        .where(and(...conds))
        .orderBy(desc(schema.ideas.postScore), desc(schema.ideas.createdAt))
        .limit(opts?.limit ?? 60);
    },

    async saveIdeas(
      brandId: string,
      items: { title: string; angle?: string; category?: string; bucket?: string; postScore?: number; sourceId?: string }[],
    ): Promise<number> {
      await assertBrand(brandId);
      if (!items.length) return 0;
      await db.insert(schema.ideas).values(
        items.map((it) => ({
          orgId,
          brandId,
          sourceId: it.sourceId ?? null,
          title: it.title,
          angle: it.angle ?? null,
          category: it.category ?? null,
          bucket: it.bucket ?? "suggested",
          postScore: it.postScore ?? 0,
        })),
      );
      return items.length;
    },

    async setIdeaStatus(brandId: string, ideaId: string, status: string): Promise<void> {
      await db
        .update(schema.ideas)
        .set({ status })
        .where(
          and(
            eq(schema.ideas.id, ideaId),
            eq(schema.ideas.orgId, orgId),
            eq(schema.ideas.brandId, brandId),
          ),
        );
    },

    /** Live counts for the Dashboard KPIs + pipeline funnel. */
    async counts(brandId: string) {
      const one = async (table: typeof schema.sources | typeof schema.ideas | typeof schema.drafts, extra?: ReturnType<typeof eq>) => {
        const conds = [eq(table.orgId, orgId), eq(table.brandId, brandId)];
        if (extra) conds.push(extra);
        const rows = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(and(...conds));
        return rows[0]?.n ?? 0;
      };
      const [sources, ideas, drafts, writing, pending, scheduled, published] = await Promise.all([
        one(schema.sources),
        one(schema.ideas),
        one(schema.drafts),
        one(schema.drafts, eq(schema.drafts.status, "draft")),
        one(schema.drafts, eq(schema.drafts.status, "pending")),
        one(schema.drafts, eq(schema.drafts.status, "scheduled")),
        one(schema.drafts, eq(schema.drafts.status, "published")),
      ]);
      return { sources, ideas, drafts, writing, pending, scheduled, published };
    },

    /** When the brand's most recent source analysis finished (for the
     * "آخر تحليل قبل ..." chip). Null when nothing has been analyzed yet. */
    async lastAnalysisAt(brandId: string): Promise<Date | null> {
      const rows = await db
        .select({ at: schema.analyses.createdAt })
        .from(schema.analyses)
        .where(and(eq(schema.analyses.orgId, orgId), eq(schema.analyses.brandId, brandId)))
        .orderBy(desc(schema.analyses.createdAt))
        .limit(1);
      return rows[0]?.at ?? null;
    },
  };
}
