import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import type { ContentDna } from "@/lib/ai/prompts";
import { normalizeDna } from "@/lib/ai/normalize";
import { type BrandProfile, normalizeProfile } from "@/lib/brand/profile";
import { type DistributionKit, normalizeKit } from "@/lib/distribution/types";
import { type MonthlyPlan, normalizePlan } from "@/lib/plan/types";
import { type LinkPage, normalizeLinkPage } from "@/lib/link/types";

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

  async function appendLedger(delta: number, reason: string, refType?: string, refId?: string, idempotencyKey?: string): Promise<number> {
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
      idempotencyKey: idempotencyKey ?? null,
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

    /** Change in DNA completeness vs the previous version (for a real delta badge).
     * Returns null when there's no prior version to compare against. */
    async dnaCompletionDelta(brandId: string): Promise<number | null> {
      const rows = await db
        .select({ pct: schema.dnaVersions.completionPct })
        .from(schema.dnaVersions)
        .where(and(eq(schema.dnaVersions.orgId, orgId), eq(schema.dnaVersions.brandId, brandId)))
        .orderBy(desc(schema.dnaVersions.version))
        .limit(2);
      if (rows.length < 2) return null;
      return rows[0].pct - rows[1].pct;
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

    /** Idempotent debit: charges at most once per `idempotencyKey`, so a retried
     * background job never double-charges. On a duplicate key it swallows the
     * unique violation and returns the current balance. */
    async debitOnce(amount: number, reason: string, key: string, refType?: string, refId?: string): Promise<number> {
      try {
        return await appendLedger(-Math.abs(amount), reason, refType, refId, key);
      } catch (e) {
        // 23505 = unique_violation. Drizzle may wrap the pg error, so check the
        // cause chain and the message too. Duplicate key ⇒ already charged.
        const err = e as { code?: string; cause?: { code?: string }; message?: string };
        if (err?.code === "23505" || err?.cause?.code === "23505" || /23505|duplicate key/i.test(err?.message ?? "")) {
          return this.balance();
        }
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

    /** Remove a source's chunks so a job retry can rebuild them cleanly (idempotency). */
    async clearChunks(brandId: string, sourceId: string): Promise<void> {
      await assertBrand(brandId);
      await db.delete(schema.sourceChunks).where(
        and(eq(schema.sourceChunks.orgId, orgId), eq(schema.sourceChunks.brandId, brandId), eq(schema.sourceChunks.sourceId, sourceId)),
      );
    },

    /** Update a source's processing status (pending|processing|ready|failed). */
    async setSourceStatus(brandId: string, sourceId: string, status: string): Promise<void> {
      await assertBrand(brandId);
      await db
        .update(schema.sources)
        .set({ status })
        .where(and(eq(schema.sources.id, sourceId), eq(schema.sources.orgId, orgId), eq(schema.sources.brandId, brandId)));
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

    async renameSource(brandId: string, sourceId: string, title: string): Promise<void> {
      await assertBrand(brandId);
      await db
        .update(schema.sources)
        .set({ title: title.trim().slice(0, 200) })
        .where(and(eq(schema.sources.id, sourceId), eq(schema.sources.orgId, orgId), eq(schema.sources.brandId, brandId)));
    },

    // --- Social connections (Phase 7.3) ---
    async saveConnection(
      brandId: string,
      platform: string,
      c: { accessToken: string; refreshToken?: string | null; expiresAt?: Date | null; externalAccountId?: string | null; accountName?: string | null; scopes?: string | null },
    ): Promise<void> {
      await assertBrand(brandId);
      await db
        .insert(schema.socialConnections)
        .values({
          orgId, brandId, platform,
          accessToken: c.accessToken,
          refreshToken: c.refreshToken ?? null,
          expiresAt: c.expiresAt ?? null,
          externalAccountId: c.externalAccountId ?? null,
          accountName: c.accountName ?? null,
          scopes: c.scopes ?? null,
          status: "connected",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.socialConnections.brandId, schema.socialConnections.platform],
          set: {
            accessToken: c.accessToken,
            refreshToken: c.refreshToken ?? null,
            expiresAt: c.expiresAt ?? null,
            externalAccountId: c.externalAccountId ?? null,
            accountName: c.accountName ?? null,
            scopes: c.scopes ?? null,
            status: "connected",
            updatedAt: new Date(),
          },
        });
    },

    async getConnection(brandId: string, platform: string) {
      const rows = await db
        .select()
        .from(schema.socialConnections)
        .where(and(eq(schema.socialConnections.orgId, orgId), eq(schema.socialConnections.brandId, brandId), eq(schema.socialConnections.platform, platform)))
        .limit(1);
      return rows[0] ?? null;
    },

    /** Connection status per platform (no tokens) for the settings UI. */
    async listConnections(brandId: string) {
      return db
        .select({
          platform: schema.socialConnections.platform,
          status: schema.socialConnections.status,
          accountName: schema.socialConnections.accountName,
          createdAt: schema.socialConnections.createdAt,
        })
        .from(schema.socialConnections)
        .where(and(eq(schema.socialConnections.orgId, orgId), eq(schema.socialConnections.brandId, brandId)));
    },

    async deleteConnection(brandId: string, platform: string): Promise<void> {
      await assertBrand(brandId);
      await db
        .delete(schema.socialConnections)
        .where(and(eq(schema.socialConnections.orgId, orgId), eq(schema.socialConnections.brandId, brandId), eq(schema.socialConnections.platform, platform)));
    },

    /** Enqueue a background job scoped to this org/brand (INFRA phase 1). The
     * user-facing entry point; the worker claims/runs it cross-org via lib/jobs. */
    async enqueueJob(
      brandId: string,
      type: string,
      payload: Record<string, unknown> = {},
      opts: { maxAttempts?: number } = {},
    ): Promise<string> {
      await assertBrand(brandId);
      const rows = await db
        .insert(schema.jobs)
        .values({ orgId, brandId, type, payload, maxAttempts: opts.maxAttempts ?? 3 })
        .returning({ id: schema.jobs.id });
      return rows[0].id;
    },

    /** Retry a failed source: requeue its dead ingest job (payload still holds
     * the storage path / text) and flip the source back to processing. Returns
     * how many jobs were requeued (0 if there was nothing to retry). */
    async requeueSourceJob(brandId: string, sourceId: string): Promise<number> {
      await assertBrand(brandId);
      const res = await db.execute(sql`
        UPDATE jobs SET status = 'queued', attempts = 0, run_after = now(),
          locked_at = null, locked_by = null, last_error = null, updated_at = now()
        WHERE org_id = ${orgId} AND brand_id = ${brandId}
          AND type = 'ingest_source' AND status = 'dead'
          AND payload->>'sourceId' = ${sourceId}
        RETURNING id
      `);
      const n = (res as unknown as unknown[]).length;
      if (n > 0) {
        await db
          .update(schema.sources)
          .set({ status: "processing" })
          .where(and(eq(schema.sources.id, sourceId), eq(schema.sources.orgId, orgId), eq(schema.sources.brandId, brandId)));
      }
      return n;
    },

    /** Read one job's status (tenancy-scoped) for the live-progress UI. */
    async getJob(brandId: string, jobId: string) {
      const rows = await db
        .select({
          id: schema.jobs.id,
          type: schema.jobs.type,
          status: schema.jobs.status,
          progress: schema.jobs.progress,
          phase: schema.jobs.phase,
          lastError: schema.jobs.lastError,
          result: schema.jobs.result,
        })
        .from(schema.jobs)
        .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId), eq(schema.jobs.brandId, brandId)))
        .limit(1);
      return rows[0] ?? null;
    },

    /** Active (queued/running) jobs for this brand — powers dashboard/vault
     * "processing" indicators without exposing other tenants' work. */
    async activeJobs(brandId: string) {
      return db
        .select({
          id: schema.jobs.id,
          type: schema.jobs.type,
          status: schema.jobs.status,
          progress: schema.jobs.progress,
          phase: schema.jobs.phase,
          payload: schema.jobs.payload,
        })
        .from(schema.jobs)
        .where(
          and(
            eq(schema.jobs.orgId, orgId),
            eq(schema.jobs.brandId, brandId),
            sql`${schema.jobs.status} in ('queued','running')`,
          ),
        )
        .orderBy(desc(schema.jobs.createdAt));
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

    /** Sample text from ALL the brand's sources (their posts/writing), for DNA
     * synthesis. Pulls the earliest chunks across sources so the voice model
     * sees a broad spread rather than one long document. */
    async brandSampleText(brandId: string, limit = 40): Promise<string> {
      const rows = await db
        .select({ content: schema.sourceChunks.content })
        .from(schema.sourceChunks)
        .where(and(eq(schema.sourceChunks.orgId, orgId), eq(schema.sourceChunks.brandId, brandId)))
        .orderBy(schema.sourceChunks.sourceId, schema.sourceChunks.idx)
        .limit(limit);
      return rows.map((r, i) => `[${i + 1}] ${r.content}`).join("\n\n");
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

    // --- Brand identity (Phase 1): profile, logo, multi-brand ---

    /** All brands for this org (for the brand switcher). */
    async listBrands() {
      return db
        .select({ id: schema.brands.id, name: schema.brands.name, logoUrl: schema.brands.logoUrl, createdAt: schema.brands.createdAt })
        .from(schema.brands)
        .where(and(eq(schema.brands.orgId, orgId), isNull(schema.brands.deletedAt)))
        .orderBy(schema.brands.createdAt);
    },

    async brandCount(): Promise<number> {
      const rows = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.brands)
        .where(and(eq(schema.brands.orgId, orgId), isNull(schema.brands.deletedAt)));
      return rows[0]?.n ?? 0;
    },

    /** Create an additional brand under this org and return its id. */
    async createBrand(name: string): Promise<string> {
      const [row] = await db
        .insert(schema.brands)
        .values({ orgId, name: name.trim().slice(0, 120) || "علامة جديدة" })
        .returning({ id: schema.brands.id });
      return row.id;
    },

    async renameBrand(brandId: string, name: string): Promise<void> {
      await assertBrand(brandId);
      await db
        .update(schema.brands)
        .set({ name: name.trim().slice(0, 120) })
        .where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId)));
    },

    async getBrand(brandId: string) {
      const rows = await db
        .select()
        .from(schema.brands)
        .where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId), isNull(schema.brands.deletedAt)))
        .limit(1);
      return rows[0] ?? null;
    },

    /** The brand's profile, always normalized (safe even if never set). */
    async getBrandProfile(brandId: string): Promise<BrandProfile> {
      const rows = await db
        .select({ profile: schema.brands.profile })
        .from(schema.brands)
        .where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId)))
        .limit(1);
      return normalizeProfile(rows[0]?.profile ?? null);
    },

    async setBrandProfile(brandId: string, profile: BrandProfile): Promise<void> {
      await assertBrand(brandId);
      await db
        .update(schema.brands)
        .set({ profile: normalizeProfile(profile) })
        .where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId)));
    },

    async setBrandLogo(brandId: string, logoUrl: string | null): Promise<void> {
      await assertBrand(brandId);
      await db
        .update(schema.brands)
        .set({ logoUrl })
        .where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId)));
    },

    // --- Products & services (Phase 1) ---
    async listProducts(brandId: string) {
      return db
        .select()
        .from(schema.products)
        .where(and(eq(schema.products.orgId, orgId), eq(schema.products.brandId, brandId), isNull(schema.products.deletedAt)))
        .orderBy(desc(schema.products.createdAt));
    },

    async saveProduct(
      brandId: string,
      p: { id?: string; name: string; kind?: string; description?: string | null; price?: string | null; url?: string | null },
    ): Promise<string> {
      await assertBrand(brandId);
      const values = {
        name: p.name.trim().slice(0, 160),
        kind: p.kind === "service" ? "service" : "product",
        description: p.description?.trim().slice(0, 1000) || null,
        price: p.price?.trim().slice(0, 60) || null,
        url: p.url?.trim().slice(0, 400) || null,
      };
      if (p.id) {
        await db
          .update(schema.products)
          .set(values)
          .where(and(eq(schema.products.id, p.id), eq(schema.products.orgId, orgId), eq(schema.products.brandId, brandId)));
        return p.id;
      }
      const [row] = await db
        .insert(schema.products)
        .values({ orgId, brandId, ...values })
        .returning({ id: schema.products.id });
      return row.id;
    },

    async deleteProduct(brandId: string, productId: string): Promise<void> {
      await assertBrand(brandId);
      await db
        .update(schema.products)
        .set({ deletedAt: new Date() })
        .where(and(eq(schema.products.id, productId), eq(schema.products.orgId, orgId), eq(schema.products.brandId, brandId)));
    },

    // --- Distribution hub (Phase 2): audience kit + target groups ---

    /** The cached audience/keywords kit, normalized (safe even if never set). */
    async getDistribution(brandId: string): Promise<DistributionKit> {
      const rows = await db
        .select({ distribution: schema.brands.distribution })
        .from(schema.brands)
        .where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId)))
        .limit(1);
      return normalizeKit(rows[0]?.distribution ?? null);
    },

    async setDistribution(brandId: string, kit: DistributionKit): Promise<void> {
      await assertBrand(brandId);
      await db
        .update(schema.brands)
        .set({ distribution: normalizeKit(kit) })
        .where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId)));
    },

    async listGroups(brandId: string) {
      return db
        .select()
        .from(schema.targetGroups)
        .where(and(eq(schema.targetGroups.orgId, orgId), eq(schema.targetGroups.brandId, brandId), isNull(schema.targetGroups.deletedAt)))
        .orderBy(desc(schema.targetGroups.createdAt));
    },

    async saveGroup(
      brandId: string,
      g: { id?: string; platform?: string; name: string; url?: string | null; memberCount?: number | null; rules?: string | null; status?: string; cadenceDays?: number; notes?: string | null },
    ): Promise<string> {
      await assertBrand(brandId);
      const values = {
        platform: g.platform?.trim().slice(0, 30) || "facebook",
        name: g.name.trim().slice(0, 200),
        url: g.url?.trim().slice(0, 500) || null,
        memberCount: typeof g.memberCount === "number" && g.memberCount >= 0 ? Math.floor(g.memberCount) : null,
        rules: g.rules?.trim().slice(0, 2000) || null,
        status: ["prospect", "active", "paused", "blocked"].includes(g.status ?? "") ? (g.status as string) : "prospect",
        cadenceDays: typeof g.cadenceDays === "number" && g.cadenceDays > 0 ? Math.min(60, Math.floor(g.cadenceDays)) : 3,
        notes: g.notes?.trim().slice(0, 1000) || null,
      };
      if (g.id) {
        await db
          .update(schema.targetGroups)
          .set(values)
          .where(and(eq(schema.targetGroups.id, g.id), eq(schema.targetGroups.orgId, orgId), eq(schema.targetGroups.brandId, brandId)));
        return g.id;
      }
      const [row] = await db
        .insert(schema.targetGroups)
        .values({ orgId, brandId, ...values })
        .returning({ id: schema.targetGroups.id });
      return row.id;
    },

    async deleteGroup(brandId: string, groupId: string): Promise<void> {
      await assertBrand(brandId);
      await db
        .update(schema.targetGroups)
        .set({ deletedAt: new Date() })
        .where(and(eq(schema.targetGroups.id, groupId), eq(schema.targetGroups.orgId, orgId), eq(schema.targetGroups.brandId, brandId)));
    },

    /** Record that a post was shared to this group now (cadence + dedupe). */
    async markGroupPosted(brandId: string, groupId: string): Promise<void> {
      await assertBrand(brandId);
      await db
        .update(schema.targetGroups)
        .set({ lastPostedAt: new Date(), status: "active" })
        .where(and(eq(schema.targetGroups.id, groupId), eq(schema.targetGroups.orgId, orgId), eq(schema.targetGroups.brandId, brandId)));
    },

    // --- Coupons (Phase 4 #24): redeem a code for credits ---
    async redeemCoupon(code: string): Promise<{ ok: true; credits: number; balance: number } | { ok: false; error: string }> {
      const norm = code.trim().toUpperCase().slice(0, 40);
      if (!norm) return { ok: false, error: "invalid" };
      const rows = await db.select().from(schema.coupons).where(eq(schema.coupons.code, norm)).limit(1);
      const coupon = rows[0];
      if (!coupon) return { ok: false, error: "invalid" };
      if (coupon.active !== "yes") return { ok: false, error: "inactive" };
      if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) return { ok: false, error: "expired" };
      if (coupon.redemptions >= coupon.maxRedemptions) return { ok: false, error: "exhausted" };
      // Record the redemption first; the unique (org, coupon) index is the real
      // guard against double-redeeming (even under a race).
      try {
        await db.insert(schema.couponRedemptions).values({ orgId, couponId: coupon.id });
      } catch (e) {
        if ((e as { code?: string })?.code === "23505") return { ok: false, error: "already" };
        throw e;
      }
      await db.update(schema.coupons).set({ redemptions: sql`${schema.coupons.redemptions} + 1` }).where(eq(schema.coupons.id, coupon.id));
      const balance = await appendLedger(Math.abs(coupon.credits), `coupon_${coupon.code}`);
      return { ok: true, credits: coupon.credits, balance };
    },

    // --- Learning center progress (Phase 4 #18) ---
    async completedLessons(): Promise<string[]> {
      const rows = await db.select({ lessonId: schema.lessonProgress.lessonId }).from(schema.lessonProgress).where(eq(schema.lessonProgress.orgId, orgId));
      return rows.map((r) => r.lessonId);
    },
    async completeLesson(lessonId: string): Promise<void> {
      await db.insert(schema.lessonProgress).values({ orgId, lessonId: lessonId.slice(0, 60) }).onConflictDoNothing({ target: [schema.lessonProgress.orgId, schema.lessonProgress.lessonId] });
    },

    // --- Affiliate referral (Phase 4 #25) ---
    async getReferral(): Promise<{ code: string; count: number }> {
      const rows = await db.select({ code: schema.organizations.referralCode }).from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1);
      let code = rows[0]?.code ?? null;
      if (!code) {
        code = "AF" + orgId.replace(/-/g, "").slice(0, 8).toUpperCase();
        await db.update(schema.organizations).set({ referralCode: code }).where(eq(schema.organizations.id, orgId));
      }
      const cnt = await db.select({ n: sql<number>`count(*)::int` }).from(schema.organizations).where(eq(schema.organizations.referredBy, orgId));
      return { code, count: cnt[0]?.n ?? 0 };
    },

    // --- Public link page (Phase 3 #17) ---
    async getLinkInfo(brandId: string) {
      const rows = await db
        .select({ handle: schema.brands.handle, linkPage: schema.brands.linkPage, name: schema.brands.name, logoUrl: schema.brands.logoUrl })
        .from(schema.brands)
        .where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId)))
        .limit(1);
      const b = rows[0];
      return { handle: b?.handle ?? null, page: normalizeLinkPage(b?.linkPage ?? null), name: b?.name ?? "", logoUrl: b?.logoUrl ?? null };
    },

    async setLinkPage(brandId: string, page: LinkPage): Promise<void> {
      await assertBrand(brandId);
      await db.update(schema.brands).set({ linkPage: normalizeLinkPage(page) }).where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId)));
    },

    /** Claim a handle. Returns false if already taken by another brand. */
    async setHandle(brandId: string, handle: string): Promise<boolean> {
      await assertBrand(brandId);
      const taken = await db
        .select({ id: schema.brands.id })
        .from(schema.brands)
        .where(and(eq(schema.brands.handle, handle), isNull(schema.brands.deletedAt)))
        .limit(1);
      if (taken.length && taken[0].id !== brandId) return false;
      await db.update(schema.brands).set({ handle }).where(and(eq(schema.brands.id, brandId), eq(schema.brands.orgId, orgId)));
      return true;
    },

    /** View/click totals for the link page (last 30 days + all time). */
    async linkStats(brandId: string) {
      const rows = await db
        .select({ kind: schema.linkEvents.kind, n: sql<number>`count(*)::int` })
        .from(schema.linkEvents)
        .where(and(eq(schema.linkEvents.orgId, orgId), eq(schema.linkEvents.brandId, brandId)))
        .groupBy(schema.linkEvents.kind);
      const map = new Map(rows.map((r) => [r.kind, r.n]));
      return { views: map.get("view") ?? 0, clicks: map.get("click") ?? 0 };
    },

    // --- Floating assistant chat (Phase 3 #20) ---
    async listAssistantMessages(brandId: string, limit = 40) {
      const rows = await db
        .select({ role: schema.assistantMessages.role, content: schema.assistantMessages.content, createdAt: schema.assistantMessages.createdAt })
        .from(schema.assistantMessages)
        .where(and(eq(schema.assistantMessages.orgId, orgId), eq(schema.assistantMessages.brandId, brandId)))
        .orderBy(desc(schema.assistantMessages.createdAt))
        .limit(limit);
      return rows.reverse(); // chronological
    },

    async saveAssistantMessages(brandId: string, msgs: { role: string; content: string }[]): Promise<void> {
      await assertBrand(brandId);
      if (!msgs.length) return;
      await db.insert(schema.assistantMessages).values(msgs.map((m) => ({ orgId, brandId, role: m.role, content: m.content.slice(0, 8000) })));
    },

    async clearAssistant(brandId: string): Promise<void> {
      await assertBrand(brandId);
      await db.delete(schema.assistantMessages).where(and(eq(schema.assistantMessages.orgId, orgId), eq(schema.assistantMessages.brandId, brandId)));
    },

    // --- Monthly content plan + trends (Phase 2 #5/#6) ---
    async getPlan(brandId: string, month: string): Promise<MonthlyPlan> {
      const rows = await db
        .select({ payload: schema.contentPlans.payload })
        .from(schema.contentPlans)
        .where(and(eq(schema.contentPlans.orgId, orgId), eq(schema.contentPlans.brandId, brandId), eq(schema.contentPlans.month, month)))
        .limit(1);
      return normalizePlan(rows[0]?.payload ?? null);
    },

    async savePlan(brandId: string, month: string, plan: MonthlyPlan): Promise<void> {
      await assertBrand(brandId);
      await db
        .insert(schema.contentPlans)
        .values({ orgId, brandId, month, payload: normalizePlan(plan) })
        .onConflictDoUpdate({
          target: [schema.contentPlans.orgId, schema.contentPlans.brandId, schema.contentPlans.month],
          set: { payload: normalizePlan(plan), updatedAt: new Date() },
        });
    },

    // --- Dismissed smart suggestions (Phase 2 #19) ---
    async listDismissed(brandId: string): Promise<string[]> {
      const rows = await db
        .select({ key: schema.dismissedSuggestions.key })
        .from(schema.dismissedSuggestions)
        .where(and(eq(schema.dismissedSuggestions.orgId, orgId), eq(schema.dismissedSuggestions.brandId, brandId)));
      return rows.map((r) => r.key);
    },

    async dismissSuggestion(brandId: string, key: string): Promise<void> {
      await assertBrand(brandId);
      await db
        .insert(schema.dismissedSuggestions)
        .values({ orgId, brandId, key: key.slice(0, 120) })
        .onConflictDoNothing({ target: [schema.dismissedSuggestions.orgId, schema.dismissedSuggestions.brandId, schema.dismissedSuggestions.key] });
    },

    /** Recent AI/background operations for the Creation Center (Phase 2 #21). */
    async recentJobs(brandId: string, limit = 30) {
      return db
        .select({
          id: schema.jobs.id,
          type: schema.jobs.type,
          status: schema.jobs.status,
          progress: schema.jobs.progress,
          phase: schema.jobs.phase,
          lastError: schema.jobs.lastError,
          createdAt: schema.jobs.createdAt,
          updatedAt: schema.jobs.updatedAt,
        })
        .from(schema.jobs)
        .where(and(eq(schema.jobs.orgId, orgId), eq(schema.jobs.brandId, brandId)))
        .orderBy(desc(schema.jobs.createdAt))
        .limit(limit);
    },

    /** Bulk-insert AI-suggested groups (dedupe by name within the brand). */
    async addSuggestedGroups(brandId: string, items: { platform: string; name: string; url?: string | null }[]): Promise<number> {
      await assertBrand(brandId);
      if (!items.length) return 0;
      const existing = await db
        .select({ name: schema.targetGroups.name })
        .from(schema.targetGroups)
        .where(and(eq(schema.targetGroups.orgId, orgId), eq(schema.targetGroups.brandId, brandId), isNull(schema.targetGroups.deletedAt)));
      const seen = new Set(existing.map((e) => e.name.trim().toLowerCase()));
      const fresh = items.filter((it) => it.name?.trim() && !seen.has(it.name.trim().toLowerCase()));
      if (!fresh.length) return 0;
      await db.insert(schema.targetGroups).values(
        fresh.map((it) => ({
          orgId, brandId,
          platform: it.platform?.trim().slice(0, 30) || "facebook",
          name: it.name.trim().slice(0, 200),
          url: it.url?.trim().slice(0, 500) || null,
          status: "prospect",
        })),
      );
      return fresh.length;
    },
  };
}
