"use server";

import { recordLinkEvent } from "@/lib/link/publicLookup";

/** Public click beacon for the link page. Records which link was clicked so the
 * owner sees click stats. Best-effort; ids are opaque and public. */
export async function recordClick(orgId: string, brandId: string, index: number): Promise<void> {
  if (!orgId || !brandId) return;
  await recordLinkEvent(orgId, brandId, "click", String(index));
}
