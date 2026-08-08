import "server-only";
import { and, desc, eq, isNull, sql, count } from "drizzle-orm";
import { db } from "./index";
import * as schema from "./schema";
import { resolveUserEmails } from "@/lib/supabase/admin";

/**
 * Admin data layer (platform super-admin). DELIBERATELY cross-tenant: unlike the
 * forOrg façade, these queries span every org. Every caller MUST be gated by
 * requireAdmin() (see lib/auth/admin.ts). ESLint exempts this file from the
 * façade rule for that reason. Never import this outside admin routes/actions.
 */

export type OrgRow = {
  id: string;
  name: string;
  balance: number;
  brands: number;
  members: number;
  ownerEmail?: string;
  suspended: boolean;
  createdAt: Date;
};

/** Latest denormalized balance per org (append-only ledger → last row wins). */
async function balancesByOrg(): Promise<Map<string, number>> {
  if (!db) return new Map();
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (org_id) org_id, balance_after
    FROM credit_ledger ORDER BY org_id, created_at DESC`);
  const map = new Map<string, number>();
  for (const r of rows as unknown as { org_id: string; balance_after: number }[]) map.set(r.org_id, Number(r.balance_after));
  return map;
}

/** All orgs with rollups (balance, brand/member counts, owner email, status). */
export async function listOrgs(): Promise<OrgRow[]> {
  if (!db) return [];
  const orgs = await db.select().from(schema.organizations).orderBy(desc(schema.organizations.createdAt));
  const [balances, brandCounts, memberRows] = await Promise.all([
    balancesByOrg(),
    db.select({ orgId: schema.brands.orgId, n: count() }).from(schema.brands).where(isNull(schema.brands.deletedAt)).groupBy(schema.brands.orgId),
    db.select({ orgId: schema.memberships.orgId, userId: schema.memberships.userId }).from(schema.memberships),
  ]);
  const brandMap = new Map(brandCounts.map((b) => [b.orgId, Number(b.n)]));
  const memberMap = new Map<string, string[]>();
  for (const m of memberRows) {
    const arr = memberMap.get(m.orgId) ?? [];
    arr.push(m.userId);
    memberMap.set(m.orgId, arr);
  }
  // One representative owner per org → resolve emails in a single batch.
  const owners = orgs.map((o) => memberMap.get(o.id)?.[0]).filter((x): x is string => !!x);
  const emails = await resolveUserEmails(owners);
  return orgs.map((o) => {
    const ownerId = memberMap.get(o.id)?.[0];
    return {
      id: o.id,
      name: o.name,
      balance: balances.get(o.id) ?? 0,
      brands: brandMap.get(o.id) ?? 0,
      members: memberMap.get(o.id)?.length ?? 0,
      ownerEmail: ownerId ? emails.get(ownerId) : undefined,
      suspended: !!o.suspendedAt,
      createdAt: o.createdAt,
    };
  });
}

export type OrgDetail = {
  org: { id: string; name: string; suspended: boolean; createdAt: Date; referralCode: string | null };
  balance: number;
  brands: { id: string; name: string; handle: string | null; createdAt: Date }[];
  members: { userId: string; role: string; email?: string }[];
  ledger: { delta: number; reason: string; balanceAfter: number; createdAt: Date }[];
  counts: { drafts: number; sources: number; ideas: number };
};

export async function orgDetail(orgId: string): Promise<OrgDetail | null> {
  if (!db) return null;
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1);
  if (!org) return null;
  const [brands, members, ledger, drafts, sources, ideas, balances] = await Promise.all([
    db.select().from(schema.brands).where(and(eq(schema.brands.orgId, orgId), isNull(schema.brands.deletedAt))),
    db.select().from(schema.memberships).where(eq(schema.memberships.orgId, orgId)),
    db.select().from(schema.creditLedger).where(eq(schema.creditLedger.orgId, orgId)).orderBy(desc(schema.creditLedger.createdAt)).limit(20),
    db.select({ n: count() }).from(schema.drafts).where(eq(schema.drafts.orgId, orgId)),
    db.select({ n: count() }).from(schema.sources).where(eq(schema.sources.orgId, orgId)),
    db.select({ n: count() }).from(schema.ideas).where(eq(schema.ideas.orgId, orgId)),
    balancesByOrg(),
  ]);
  const emails = await resolveUserEmails(members.map((m) => m.userId));
  return {
    org: { id: org.id, name: org.name, suspended: !!org.suspendedAt, createdAt: org.createdAt, referralCode: org.referralCode },
    balance: balances.get(orgId) ?? 0,
    brands: brands.map((b) => ({ id: b.id, name: b.name, handle: b.handle, createdAt: b.createdAt })),
    members: members.map((m) => ({ userId: m.userId, role: m.role, email: emails.get(m.userId) })),
    ledger: ledger.map((l) => ({ delta: l.delta, reason: l.reason, balanceAfter: l.balanceAfter, createdAt: l.createdAt })),
    counts: { drafts: Number(drafts[0]?.n ?? 0), sources: Number(sources[0]?.n ?? 0), ideas: Number(ideas[0]?.n ?? 0) },
  };
}

/** Adjust an org's credits by delta (may be negative), appending a ledger row
 * with a correct running balance. Reason is namespaced so it's auditable. */
export async function adjustCredits(orgId: string, delta: number, note: string): Promise<number> {
  if (!db) throw new Error("no db");
  const balances = await balancesByOrg();
  const current = balances.get(orgId) ?? 0;
  const next = current + delta;
  await db.insert(schema.creditLedger).values({
    orgId,
    delta,
    reason: `admin_adjust:${note.slice(0, 40) || "manual"}`,
    balanceAfter: next,
  });
  return next;
}

export async function setSuspended(orgId: string, suspended: boolean): Promise<void> {
  if (!db) throw new Error("no db");
  await db.update(schema.organizations).set({ suspendedAt: suspended ? new Date() : null }).where(eq(schema.organizations.id, orgId));
}

/** Platform-wide KPIs for the admin dashboard. */
export async function platformStats(): Promise<{
  orgs: number;
  suspended: number;
  brands: number;
  admins: number;
  creditsIssued: number;
  creditsSpent: number;
  newOrgs7d: number;
}> {
  if (!db) return { orgs: 0, suspended: 0, brands: 0, admins: 0, creditsIssued: 0, creditsSpent: 0, newOrgs7d: 0 };
  const [orgs, suspended, brands, admins, issued, spent, recent] = await Promise.all([
    db.select({ n: count() }).from(schema.organizations),
    db.select({ n: count() }).from(schema.organizations).where(sql`suspended_at is not null`),
    db.select({ n: count() }).from(schema.brands).where(isNull(schema.brands.deletedAt)),
    db.select({ n: count() }).from(schema.platformAdmins),
    db.execute(sql`SELECT COALESCE(SUM(delta),0) AS s FROM credit_ledger WHERE delta > 0`),
    db.execute(sql`SELECT COALESCE(SUM(delta),0) AS s FROM credit_ledger WHERE delta < 0`),
    db.select({ n: count() }).from(schema.organizations).where(sql`created_at > now() - interval '7 days'`),
  ]);
  const num = (r: unknown, k: string) => Number((r as Record<string, unknown>[])[0]?.[k] ?? 0);
  return {
    orgs: Number(orgs[0]?.n ?? 0),
    suspended: Number(suspended[0]?.n ?? 0),
    brands: Number(brands[0]?.n ?? 0),
    admins: Number(admins[0]?.n ?? 0),
    creditsIssued: num(issued, "s"),
    creditsSpent: Math.abs(num(spent, "s")),
    newOrgs7d: Number(recent[0]?.n ?? 0),
  };
}

/* ---------- Coupons ---------- */
export async function listCoupons() {
  if (!db) return [];
  return db.select().from(schema.coupons).orderBy(desc(schema.coupons.createdAt));
}

export async function createCoupon(input: { code: string; credits: number; maxRedemptions: number; expiresAt?: Date | null }) {
  if (!db) throw new Error("no db");
  await db.insert(schema.coupons).values({
    code: input.code.trim().toUpperCase(),
    credits: input.credits,
    maxRedemptions: input.maxRedemptions,
    expiresAt: input.expiresAt ?? null,
  });
}

export async function setCouponActive(id: string, active: boolean): Promise<void> {
  if (!db) throw new Error("no db");
  await db.update(schema.coupons).set({ active: active ? "yes" : "no" }).where(eq(schema.coupons.id, id));
}

/* ---------- Platform admins ---------- */
export async function getAdminRow(userId: string) {
  if (!db) return null;
  const [row] = await db.select().from(schema.platformAdmins).where(eq(schema.platformAdmins.userId, userId)).limit(1);
  return row ?? null;
}

export async function ensureAdminRow(userId: string, email?: string): Promise<void> {
  if (!db) return;
  await db.insert(schema.platformAdmins).values({ userId, email: email ?? null }).onConflictDoNothing();
}

export async function listAdmins() {
  if (!db) return [];
  const rows = await db.select().from(schema.platformAdmins).orderBy(desc(schema.platformAdmins.createdAt));
  const emails = await resolveUserEmails(rows.map((r) => r.userId));
  return rows.map((r) => ({ userId: r.userId, email: r.email ?? emails.get(r.userId), createdAt: r.createdAt }));
}
