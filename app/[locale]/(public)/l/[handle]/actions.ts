"use server";

import { brandByHandle, recordLinkEvent } from "@/lib/link/publicLookup";

/** Public click beacon for the link page. Records which link was clicked so the
 * owner sees click stats. The handle (from the public URL) is the only trusted
 * input — we resolve the org/brand server-side so a visitor can't attribute
 * clicks to an arbitrary account, and internal ids never reach the browser.
 * Best-effort; never throws. */
export async function recordClick(handle: string, index: number): Promise<void> {
  if (!handle) return;
  const brand = await brandByHandle(handle.toLowerCase());
  if (!brand) return;
  await recordLinkEvent(brand.orgId, brand.brandId, "click", String(index));
}
