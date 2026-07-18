import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Tenancy-ready schema (ARCHITECTURE A2). Every tenant row carries org_id AND
 * brand_id from day one, even though the MVP UX is single-brand. `content_dna`
 * is intentionally NOT a table — brands point at the current dna_versions row
 * (C6 / ADR).
 */

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  currentDnaVersionId: uuid("current_dna_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const dnaVersions = pgTable("dna_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id),
  version: integer("version").notNull(),
  payload: jsonb("payload").notNull(),
  completionPct: integer("completion_pct").notNull().default(0),
  builtFromSourceIds: jsonb("built_from_source_ids"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const drafts = pgTable("drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id),
  dnaVersionId: uuid("dna_version_id").references(() => dnaVersions.id),
  ideaId: uuid("idea_id"),
  // Which knowledge source this draft came from (via its idea, or the Studio
  // source picker). Powers the Vault card's "بوست" count.
  sourceId: uuid("source_id"),
  platform: text("platform").notNull(),
  topic: text("topic"),
  hook: text("hook").notNull(),
  body: text("body").notNull(),
  // English enum values only — never store display strings (A6).
  // status: draft | pending | approved | needs_edit | scheduled | published | rejected
  status: text("status").notNull().default("draft"),
  // Reviewer's reason when sent back for edit or rejected (Approvals).
  reviewNote: text("review_note"),
  postScore: integer("post_score").notNull().default(0),
  dnaMatch: integer("dna_match").notNull().default(0),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Links a Supabase auth user to an organization (org → memberships → brands).
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // MVP invariant: exactly ONE workspace per user. Enforced at the DB level so
    // concurrent first-requests can't each create an org (bootstrap race).
    // Relax this when multi-workspace membership ships.
    uniqueIndex("memberships_user_uq").on(t.userId),
  ],
);

// Append-only credit ledger (ADR-004 / A4). Balance is derived (sum of deltas);
// balance_after is a denormalized convenience. Never UPDATE/DELETE rows.
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    balanceAfter: integer("balance_after").notNull(),
    // Optional idempotency key: a retried background job debits at most once
    // (INFRA phase 5). Enforced by the partial unique index below.
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // At most ONE signup_grant per org, enforced at the DB level so concurrent
    // logins can't double-grant the welcome credits (grantOnce races).
    uniqueIndex("credit_ledger_signup_grant_uq")
      .on(t.orgId)
      .where(sql`${t.reason} = 'signup_grant'`),
    // At most ONE ledger entry per (org, idempotency_key) — the double-debit guard.
    uniqueIndex("credit_ledger_idem_uq")
      .on(t.orgId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
  ],
);

// Per-source AI analysis (summary, key ideas, quotes, etc.). One row per source.
export const analyses = pgTable("analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  sourceId: uuid("source_id").notNull(),
  summary: text("summary").notNull(),
  keyIdeas: jsonb("key_ideas").notNull(),
  quotes: jsonb("quotes").notNull(),
  audience: jsonb("audience"),
  opportunities: jsonb("opportunities"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// A content idea (from a topic, a source, or trending) with a predicted score.
export const ideas = pgTable("ideas", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  sourceId: uuid("source_id"),
  title: text("title").notNull(),
  angle: text("angle"),
  // category: educational | story | list | guide | analytical | contrarian
  category: text("category"),
  // bucket: suggested | source | trending  ·  status: new | saved | used
  bucket: text("bucket").notNull().default("suggested"),
  status: text("status").notNull().default("new"),
  postScore: integer("post_score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// A piece of ingested content (pasted text now; URL/PDF/audio in Stage 4).
export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id),
  // English enum values only (A6): text | url | pdf | audio | video.
  kind: text("kind").notNull().default("text"),
  title: text("title"),
  // Captured on the Upload screen (design: لغة المحتوى / تصنيف المصدر).
  // language: ar | en | mixed · category: course | lecture | book | script | live | interview
  language: text("language"),
  category: text("category"),
  // pending | processing | ready | failed.
  status: text("status").notNull().default("ready"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Background job queue (INFRA phase 1). Durable, tenancy-scoped work items that
// run outside the request lifetime: transcription, embedding, analysis. Claimed
// with FOR UPDATE SKIP LOCKED so concurrent workers never grab the same job.
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    brandId: uuid("brand_id").notNull(),
    // Handler key, e.g. ingest_source | analyze_source.
    type: text("type").notNull(),
    // queued | running | done | failed | dead
    status: text("status").notNull().default("queued"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    progress: integer("progress").notNull().default(0),
    phase: text("phase"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"),
    result: jsonb("result"),
    // Concurrency control + retry scheduling.
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    runAfter: timestamp("run_after", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Worker claim path: pending jobs whose run_after has arrived, oldest first.
    index("jobs_claim_idx").on(t.status, t.runAfter),
    index("jobs_brand_idx").on(t.orgId, t.brandId),
  ],
);

// Social platform connections (Phase 7.3). One row per (brand, platform) holding
// the OAuth tokens the publisher uses to post on the user's behalf. Tenancy-scoped;
// tokens live behind the service role and Supabase at-rest encryption.
export const socialConnections = pgTable(
  "social_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    brandId: uuid("brand_id").notNull(),
    // linkedin | x | instagram | facebook
    platform: text("platform").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    externalAccountId: text("external_account_id"),
    accountName: text("account_name"),
    scopes: text("scopes"),
    // connected | expired | revoked
    status: text("status").notNull().default("connected"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // One live connection per brand+platform.
    uniqueIndex("social_conn_brand_platform_uq").on(t.brandId, t.platform),
    index("social_conn_brand_idx").on(t.orgId, t.brandId),
  ],
);

// Retrieval unit: a chunk of a source plus its Voyage embedding (ADR-003).
export const sourceChunks = pgTable(
  "source_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    brandId: uuid("brand_id").notNull(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    idx: integer("idx").notNull(),
    content: text("content").notNull(),
    tokens: integer("tokens"),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // HNSW cosine index for approximate nearest-neighbour retrieval.
    index("source_chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("source_chunks_brand_idx").on(t.orgId, t.brandId),
  ],
);
