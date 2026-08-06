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
  // Phase 1 (brand depth): logo + a JSON profile holding content constraints,
  // production guidance, team size, 3-level descriptions, and the identity Q&A.
  // These feed the generation prompts alongside the DNA.
  logoUrl: text("logo_url"),
  profile: jsonb("profile"),
  // Phase 2 (distribution hub): cached AI-generated audience profile + group
  // search keywords, shape { audience, keywords, generatedAt } (see lib/distribution).
  distribution: jsonb("distribution"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Products & services the brand offers (Phase 1). Injected into content
// generation so posts can reference what the brand actually sells.
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    brandId: uuid("brand_id").notNull(),
    name: text("name").notNull(),
    // product | service
    kind: text("kind").notNull().default("product"),
    description: text("description"),
    price: text("price"),
    url: text("url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("products_brand_idx").on(t.orgId, t.brandId)],
);

// Target groups/communities the brand distributes posts to (Phase 2 —
// distribution hub). This is the curated "sheet": the user (aided by AI
// suggestions) tracks groups, their rules, cadence, and last-posted time so
// assisted posting can dedupe and respect each community's pace. No automation
// of the user's account — posting stays human-in-the-loop by design.
export const targetGroups = pgTable(
  "target_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    brandId: uuid("brand_id").notNull(),
    platform: text("platform").notNull().default("facebook"),
    name: text("name").notNull(),
    url: text("url"),
    memberCount: integer("member_count"),
    rules: text("rules"),
    // prospect | active | paused | blocked
    status: text("status").notNull().default("prospect"),
    // minimum days between posts to this group (anti-spam cadence)
    cadenceDays: integer("cadence_days").notNull().default(3),
    notes: text("notes"),
    lastPostedAt: timestamp("last_posted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("target_groups_brand_idx").on(t.orgId, t.brandId)],
);

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

// Monthly content plan + trends (Phase 2). One row per brand-month holds the
// AI-generated plan (array of scheduled post ideas) and the month's trend
// angles, so the Planning hub can render and regenerate them cheaply.
export const contentPlans = pgTable(
  "content_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    brandId: uuid("brand_id").notNull(),
    // 'YYYY-MM'
    month: text("month").notNull(),
    // { plan: {day,pillar,title,angle,format}[], trends: string[], generatedAt }
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("content_plans_brand_month_idx").on(t.orgId, t.brandId, t.month)],
);

// Per-user dismissed smart suggestions (Phase 2 #19). Keyed by a stable
// suggestion key so a dismissed tip stays hidden without re-showing.
export const dismissedSuggestions = pgTable(
  "dismissed_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    brandId: uuid("brand_id").notNull(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("dismissed_suggestions_key_idx").on(t.orgId, t.brandId, t.key)],
);

// Floating AI assistant chat history (Phase 3 #20). Brand-scoped so the
// assistant remembers the conversation and stays in the brand's context.
export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    brandId: uuid("brand_id").notNull(),
    // user | assistant
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("assistant_messages_brand_idx").on(t.orgId, t.brandId, t.createdAt)],
);
