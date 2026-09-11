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
  // Affiliate referral code (#25) — an org's shareable code; new signups that
  // use it are attributed via referred_by.
  referralCode: text("referral_code"),
  referredBy: uuid("referred_by"),
  // Admin panel: when set, the account is suspended (soft-blocked). The app shell
  // checks this and locks the workspace; the row is never deleted.
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  // --- Subscription (Stripe). All nullable/defaulted: an org with no
  // subscription is simply on "free", which is the state every existing row
  // already has. Stripe remains the source of truth for money and lifecycle;
  // these columns are the local projection the app gates entitlements on. ---
  plan: text("plan").notNull().default("free"),
  /** Mirrors Stripe's subscription status: active, trialing, past_due, canceled… */
  planStatus: text("plan_status"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  /** End of the paid period — access continues until this even after cancelling. */
  planRenewsAt: timestamp("plan_renews_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Platform super-admins (admin panel). Distinct from memberships.role, which is
// per-workspace ("owner"). A row here grants access to /admin across ALL orgs.
// Bootstrapped from the ADMIN_EMAILS env allowlist; additional admins can be
// promoted from within the panel (writing a row here).
export const platformAdmins = pgTable(
  "platform_admins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("platform_admins_user_uq").on(t.userId)],
);

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
  // Phase 3 (#17): public "link in bio" page — a unique handle + a JSON config
  // { headline, bio, links: {label,url}[] }.
  handle: text("handle"),
  linkPage: jsonb("link_page"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  // The handle is the public page's address, so it must be globally unique —
  // otherwise one workspace could claim another's URL. The index has existed
  // since 0018 but was missing from this file, which is the only thing that
  // would have stopped `drizzle-kit push` from dropping it.
  uniqueIndex("brands_handle_idx").on(t.handle),
  // currentBrand() looks a workspace's brand up by org on nearly every page
  // render, and the handle index above cannot serve that.
  index("brands_org_idx").on(t.orgId),
]);

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
}, (t) => [
  // The DNA history screen and every generation read the latest version for
  // one brand, newest first.
  index("dna_versions_brand_idx").on(t.orgId, t.brandId, t.createdAt),
]);

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
  // --- Publishing (Phase 7.4). Set by the publisher, never by the user. ---
  publishedAt: timestamp("published_at", { withTimezone: true }),
  /** The platform's own id for the created post (tweet id, LinkedIn URN, …). */
  externalPostId: text("external_post_id"),
  /** Permalink to the live post, when the platform gives us one. */
  externalUrl: text("external_url"),
  /** Why the last publish attempt failed — shown to the user, so keep it short. */
  publishError: text("publish_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  // The publisher's claim query: due scheduled drafts, oldest first.
  index("drafts_due_idx").on(t.status, t.scheduledAt),
  // Everything else. Drafts are the most-read table in the product — the
  // dashboard counts, the Vault, Approvals, Studio and the Calendar all filter
  // by (org, brand) — and without this every one of those was a sequential scan
  // over every tenant's rows. `created_at` rides along so the usual
  // "newest first" order comes from the index rather than a sort.
  index("drafts_brand_idx").on(t.orgId, t.brandId, t.createdAt),
]);

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
    // The balance. Both indexes above are PARTIAL, so neither could serve a
    // plain lookup by org — and `balance()` sums this table on nearly every
    // page render while the ledger, being append-only, only ever grows. That
    // was a sequential scan over every tenant's history, forever.
    index("credit_ledger_org_idx").on(t.orgId, t.createdAt),
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
}, (t) => [
  // Every analysis read is per brand; without this the table is scanned.
  index("analyses_brand_idx").on(t.orgId, t.brandId),
]);

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
}, (t) => [
  index("ideas_brand_idx").on(t.orgId, t.brandId, t.createdAt),
]);

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
}, (t) => [
  index("sources_brand_idx").on(t.orgId, t.brandId, t.createdAt),
]);

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

// Tax invoices (Phase 8). One row per Stripe invoice, written by the webhook —
// never by the browser. Stripe is the system of record (it issues the sequential
// number and the PDF that a tax authority accepts); this table is a local,
// queryable projection so the billing screen can list a workspace's invoices
// without an API round-trip, and so the history survives independently of an
// API key that may be rotated or revoked.
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    /** Stripe's invoice id — the idempotency key for the webhook's upsert. */
    stripeInvoiceId: text("stripe_invoice_id").notNull(),
    /** Stripe's sequential, human-facing invoice number (e.g. "A1B2C3-0001"). */
    number: text("number"),
    // draft | open | paid | uncollectible | void
    status: text("status").notNull(),
    currency: text("currency").notNull(),
    // All amounts in the currency's smallest unit (cents), never floats.
    subtotalCents: integer("subtotal_cents").notNull(),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    amountPaidCents: integer("amount_paid_cents").notNull().default(0),
    /** Effective VAT rate, derived from tax ÷ taxable amount and stored as basis
     * points so 15% is exactly 1500 — a float here would print as 14.999%. */
    taxRateBps: integer("tax_rate_bps"),
    /** Billing identity AS INVOICED. Copied, not joined: an invoice must keep
     * showing the name, country and tax number that were on it at issue. */
    customerName: text("customer_name"),
    customerCountry: text("customer_country"),
    customerTaxId: text("customer_tax_id"),
    /** Stripe-hosted, signed links — the PDF is the document the customer files. */
    hostedInvoiceUrl: text("hosted_invoice_url"),
    invoicePdfUrl: text("invoice_pdf_url"),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Stripe delivers at least once and an invoice changes state (finalized →
    // paid); the upsert target keeps that one row instead of one per delivery.
    uniqueIndex("invoices_stripe_id_uq").on(t.stripeInvoiceId),
    index("invoices_org_idx").on(t.orgId, t.issuedAt),
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

// Analytics for the public link page (Phase 3 #17): a row per view/click.
export const linkEvents = pgTable(
  "link_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    brandId: uuid("brand_id").notNull(),
    // view | click
    kind: text("kind").notNull(),
    ref: text("ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("link_events_brand_idx").on(t.orgId, t.brandId, t.createdAt)],
);

// --- Phase 4 (growth & business) ---

// Discount/credit coupons (#24). Redeeming a code grants credits — a real way
// to hand out credits (beta, promos) without a payment gateway.
export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    credits: integer("credits").notNull().default(0),
    maxRedemptions: integer("max_redemptions").notNull().default(1),
    redemptions: integer("redemptions").notNull().default(0),
    active: text("active").notNull().default("yes"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("coupons_code_idx").on(t.code)],
);

// One redemption per org per coupon.
export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    couponId: uuid("coupon_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("coupon_redemptions_idx").on(t.orgId, t.couponId)],
);

// Learning-center progress (#18): which lessons an org completed.
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    lessonId: text("lesson_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("lesson_progress_idx").on(t.orgId, t.lessonId)],
);

// Generated media assets (Phase 3 media studio, upgraded). Every voice/image/
// video generation is persisted to the public bucket and recorded here so the
// user has a durable gallery, and assets can be linked back to the draft they
// were made for (connecting media to content).
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    brandId: uuid("brand_id").notNull(),
    // voice | image | video
    kind: text("kind").notNull(),
    url: text("url").notNull(),
    prompt: text("prompt"),
    draftId: uuid("draft_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("media_assets_brand_idx").on(t.orgId, t.brandId)],
);
