import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { normalizeLinkPage, type LinkPage } from "./types";

/**
 * Public brand lookup by handle (Phase 3 #17). This is intentionally OUTSIDE the
 * forOrg façade: the public link page has no org context — the handle IS the
 * lookup key — and it only ever reads/writes public link-page data. Allowlisted
 * in eslint.config.mjs for that reason.
 */
export type PublicBrand = { orgId: string; brandId: string; name: string; logoUrl: string | null; page: LinkPage };

export async function brandByHandle(handle: string): Promise<PublicBrand | null> {
  if (!db) return null;
  const rows = await db
    .select({ id: schema.brands.id, orgId: schema.brands.orgId, name: schema.brands.name, logoUrl: schema.brands.logoUrl, linkPage: schema.brands.linkPage })
    .from(schema.brands)
    .where(and(eq(schema.brands.handle, handle), isNull(schema.brands.deletedAt)))
    .limit(1);
  const b = rows[0];
  if (!b) return null;
  return { orgId: b.orgId, brandId: b.id, name: b.name, logoUrl: b.logoUrl, page: normalizeLinkPage(b.linkPage) };
}

/** Record a public link-page event (view/click). Best-effort, never throws. */
export async function recordLinkEvent(orgId: string, brandId: string, kind: "view" | "click", ref?: string): Promise<void> {
  if (!db) return;
  try {
    await db.insert(schema.linkEvents).values({ orgId, brandId, kind, ref: ref?.slice(0, 200) ?? null });
  } catch {
    /* analytics is best-effort */
  }
}
