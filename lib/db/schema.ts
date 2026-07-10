import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

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
  platform: text("platform").notNull(),
  topic: text("topic"),
  hook: text("hook").notNull(),
  body: text("body").notNull(),
  // English enum values only — never store display strings (A6).
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Links a Supabase auth user to an organization (org → memberships → brands).
export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  role: text("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Append-only credit ledger (ADR-004 / A4). Balance is derived (sum of deltas);
// balance_after is a denormalized convenience. Never UPDATE/DELETE rows.
export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  refType: text("ref_type"),
  refId: uuid("ref_id"),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
