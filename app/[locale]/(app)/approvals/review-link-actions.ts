"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { requireCap } from "@/lib/auth/guard";
import { newToken, hashToken } from "@/lib/tokens";
import { REVIEW_LINK_TTL_DAYS } from "@/lib/review/publicReview";
import { log } from "@/lib/log";

/**
 * Managing the client review link (Phase 4).
 *
 * Creating one hands an outsider a view of this brand's review queue, so it
 * sits behind the same capability as approving: the people who run the review
 * cycle decide who else is in it.
 */

const MAX_LINKS = 20;

export type ReviewLinkRow = {
  id: string;
  label: string | null;
  state: "active" | "revoked" | "expired";
  lastUsedAt: string | null;
  createdAt: string;
};

export type LinksView = { ok: true; links: ReviewLinkRow[] } | { ok: false; error: string };

function stateOf(l: { revokedAt: Date | null; expiresAt: Date | null }): ReviewLinkRow["state"] {
  if (l.revokedAt) return "revoked";
  if (l.expiresAt && l.expiresAt.getTime() <= Date.now()) return "expired";
  return "active";
}

export async function reviewLinks(): Promise<LinksView> {
  try {
    if (!db) return { ok: false, error: "no_session" };
    const gate = await requireCap("approve");
    if (!gate.ok) return { ok: false, error: gate.error };
    const rows = await forOrg(db, gate.orgId).listReviewLinks(gate.brandId);
    return {
      ok: true,
      links: rows.map((l) => ({
        id: l.id,
        label: l.label,
        state: stateOf(l),
        lastUsedAt: l.lastUsedAt ? l.lastUsedAt.toISOString() : null,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}

export type CreateLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: "no_session" | "forbidden" | "too_many" | "failed" };

export async function createReviewLink(labelRaw: string, origin?: string): Promise<CreateLinkResult> {
  try {
    if (!db) return { ok: false, error: "no_session" };
    const gate = await requireCap("approve");
    if (!gate.ok) return { ok: false, error: gate.error };

    const org = forOrg(db, gate.orgId);
    // Every live link is another door into the same review queue. Capping them
    // keeps "revoke the one that leaked" a thing a person can actually do.
    const existing = await org.listReviewLinks(gate.brandId, MAX_LINKS + 1);
    if (existing.filter((l) => stateOf(l) === "active").length >= MAX_LINKS) return { ok: false, error: "too_many" };

    // The raw token exists here and in the link the agency copies; only the
    // hash is stored.
    const token = newToken();
    await org.createReviewLink(gate.brandId, {
      label: labelRaw.trim().slice(0, 80) || null,
      tokenHash: hashToken(token),
      createdBy: gate.userId,
      expiresAt: new Date(Date.now() + REVIEW_LINK_TTL_DAYS * 24 * 60 * 60 * 1000),
    });

    log.info("review_link.created", { orgId: gate.orgId, brandId: gate.brandId });
    revalidatePath("/[locale]/(app)/approvals", "page");
    return { ok: true, url: `${(origin ?? "").replace(/\/+$/, "")}/r/${token}` };
  } catch (e) {
    log.error("review_link.create_failed", { error: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: "failed" };
  }
}

export async function revokeReviewLink(linkId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!db) return { ok: false, error: "no_session" };
    const gate = await requireCap("approve");
    if (!gate.ok) return { ok: false, error: gate.error };
    const done = await forOrg(db, gate.orgId).revokeReviewLink(gate.brandId, linkId);
    revalidatePath("/[locale]/(app)/approvals", "page");
    return done ? { ok: true } : { ok: false, error: "not_found" };
  } catch {
    return { ok: false, error: "failed" };
  }
}
