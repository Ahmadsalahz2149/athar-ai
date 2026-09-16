import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { asSystem } from "@/lib/db/rls";
import { hashToken } from "@/lib/tokens";

/**
 * The client review link (Phase 4).
 *
 * An agency shows a month of posts to its end client, who says yes or asks for
 * a change — with no account, no sign-up and no seat. The approval flow already
 * existed; what was missing was a surface a person outside the workspace could
 * safely be pointed at.
 *
 * Outside the forOrg façade, and allowlisted for it, for the same reason as the
 * public link page: there is no session and no org context — the token IS the
 * lookup key. Everything below is then bounded to the single brand that token
 * resolved to.
 *
 * What this module deliberately CANNOT do is as important as what it can. It
 * reads a fixed set of columns from one table for one brand, in one review
 * state set. It cannot reach sources, the DNA, credits, invoices, other brands
 * or any other workspace, and it writes exactly two statuses. A review link
 * that quietly widens into account access is how an agency loses a client.
 */

/** The only statuses a client is shown. `draft` is work in progress the agency
 * has not offered yet, `rejected` is a decision already taken, and published
 * posts are not a review question. */
export const REVIEWABLE = ["pending", "needs_edit", "approved", "scheduled"] as const;

/** How far back the link looks. A review link is about the current cycle, not
 * an archive of everything the brand ever wrote. */
export const REVIEW_WINDOW_DAYS = 60;
/** How long a link stays good. Longer than a content cycle, shorter than a
 * client relationship — a link that never expires is one nobody remembers to
 * revoke when the engagement ends. */
export const REVIEW_LINK_TTL_DAYS = 90;
const MAX_POSTS = 60;
const MAX_NOTE = 600;

export type ReviewPost = {
  id: string;
  platform: string;
  hook: string;
  body: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  reviewNote: string | null;
  media: { id: string; kind: string; url: string }[];
};

export type ReviewBoard = {
  brandName: string;
  logoUrl: string | null;
  label: string | null;
  posts: ReviewPost[];
};

export type ReviewFailure = "invalid" | "expired" | "revoked" | "no_db";

type LinkRow = { id: string; orgId: string; brandId: string; label: string | null };

/** Resolve a token to its link, or say precisely why it does not work. */
async function resolveLink(token: string): Promise<{ ok: true; link: LinkRow } | { ok: false; reason: ReviewFailure }> {
  if (!db) return { ok: false, reason: "no_db" };
  if (!token) return { ok: false, reason: "invalid" };

  const rows = await asSystem(db, (tx) => tx
    .select({
      id: schema.reviewLinks.id,
      orgId: schema.reviewLinks.orgId,
      brandId: schema.reviewLinks.brandId,
      label: schema.reviewLinks.label,
      expiresAt: schema.reviewLinks.expiresAt,
      revokedAt: schema.reviewLinks.revokedAt,
    })
    .from(schema.reviewLinks)
    .where(eq(schema.reviewLinks.tokenHash, hashToken(token)))
    .limit(1));

  const link = rows[0];
  if (!link) return { ok: false, reason: "invalid" };
  if (link.revokedAt) return { ok: false, reason: "revoked" };
  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, link: { id: link.id, orgId: link.orgId, brandId: link.brandId, label: link.label } };
}

/** Everything the client may see, and nothing else. */
export async function reviewBoard(token: string): Promise<{ ok: true; board: ReviewBoard } | { ok: false; reason: ReviewFailure }> {
  const found = await resolveLink(token);
  if (!found.ok) return found;
  const { link } = found;

  const board = await asSystem(db!, async (tx) => {
    const brandRows = await tx
      .select({ name: schema.brands.name, logoUrl: schema.brands.logoUrl })
      .from(schema.brands)
      .where(and(eq(schema.brands.id, link.brandId), eq(schema.brands.orgId, link.orgId), isNull(schema.brands.deletedAt)))
      .limit(1);
    if (!brandRows.length) return null;

    const drafts = await tx
      .select({
        id: schema.drafts.id,
        platform: schema.drafts.platform,
        hook: schema.drafts.hook,
        body: schema.drafts.body,
        status: schema.drafts.status,
        scheduledAt: schema.drafts.scheduledAt,
        createdAt: schema.drafts.createdAt,
        reviewNote: schema.drafts.reviewNote,
      })
      .from(schema.drafts)
      .where(and(
        eq(schema.drafts.orgId, link.orgId),
        eq(schema.drafts.brandId, link.brandId),
        isNull(schema.drafts.deletedAt),
        inArray(schema.drafts.status, [...REVIEWABLE]),
        sql`${schema.drafts.createdAt} > now() - make_interval(days => ${REVIEW_WINDOW_DAYS})`,
      ))
      .orderBy(desc(schema.drafts.createdAt))
      .limit(MAX_POSTS);

    const media: Record<string, { id: string; kind: string; url: string }[]> = {};
    if (drafts.length) {
      const assets = await tx
        .select({ id: schema.mediaAssets.id, kind: schema.mediaAssets.kind, url: schema.mediaAssets.url, draftId: schema.mediaAssets.draftId })
        .from(schema.mediaAssets)
        .where(and(
          eq(schema.mediaAssets.orgId, link.orgId),
          eq(schema.mediaAssets.brandId, link.brandId),
          isNull(schema.mediaAssets.deletedAt),
          inArray(schema.mediaAssets.draftId, drafts.map((d) => d.id)),
        ));
      for (const a of assets) if (a.draftId) (media[a.draftId] ??= []).push({ id: a.id, kind: a.kind, url: a.url });
    }

    return {
      brandName: brandRows[0].name,
      logoUrl: brandRows[0].logoUrl,
      label: link.label,
      posts: drafts.map((d) => ({
        id: d.id,
        platform: d.platform,
        hook: d.hook,
        body: d.body,
        status: d.status,
        scheduledAt: d.scheduledAt ? d.scheduledAt.toISOString() : null,
        createdAt: d.createdAt.toISOString(),
        reviewNote: d.reviewNote,
        media: media[d.id] ?? [],
      })),
    };
  });

  if (!board) return { ok: false, reason: "invalid" };

  // The agency wants to know the link is being used. Its own transaction and
  // swallowed on failure: under RLS a failed statement aborts the transaction
  // it is in, so a best-effort write inside the read above would take the whole
  // board down with it — and a client who cannot see their posts because we
  // could not write a timestamp is an absurd way to lose a review cycle.
  try {
    await asSystem(db!, (tx) => tx
      .update(schema.reviewLinks)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.reviewLinks.id, link.id)));
  } catch {
    /* best-effort */
  }

  return { ok: true, board };
}

export type ReviewDecision = "approved" | "needs_edit";

/**
 * Record the client's answer on one post.
 *
 * Two statuses, and no others. A public token must not be able to schedule,
 * publish, reject outright or edit the text — the client's job is to say yes or
 * say what to change, and the agency decides what happens next.
 *
 * The write is bounded three ways: to the link's brand, to a post currently in
 * a reviewable state, and to the two statuses above. So a token for one brand
 * cannot touch another's post even with a valid id.
 */
export async function recordReviewDecision(
  token: string,
  draftId: string,
  decision: ReviewDecision,
  note?: string,
): Promise<{ ok: true } | { ok: false; reason: ReviewFailure | "not_found" | "bad_decision" }> {
  if (decision !== "approved" && decision !== "needs_edit") return { ok: false, reason: "bad_decision" };
  const found = await resolveLink(token);
  if (!found.ok) return found;
  const { link } = found;

  // Attribute the note to the link it came through, so the agency reading it in
  // Approvals knows it is the client speaking and not a teammate.
  const clean = (note ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NOTE);
  const attributed = clean ? (link.label ? `${link.label}: ${clean}` : clean) : null;

  const updated = await asSystem(db!, (tx) => tx
    .update(schema.drafts)
    .set({ status: decision, reviewNote: attributed })
    .where(and(
      eq(schema.drafts.id, draftId),
      eq(schema.drafts.orgId, link.orgId),
      eq(schema.drafts.brandId, link.brandId),
      isNull(schema.drafts.deletedAt),
      inArray(schema.drafts.status, [...REVIEWABLE]),
    ))
    .returning({ id: schema.drafts.id }));

  return updated.length ? { ok: true } : { ok: false, reason: "not_found" };
}
