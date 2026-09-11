"use server";

import { brandByHandle, recordLinkEvent } from "@/lib/link/publicLookup";
import { consume, LIMITS } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

/** Public click beacon for the link page. Records which link was clicked so the
 * owner sees click stats. The handle (from the public URL) is the only trusted
 * input — we resolve the org/brand server-side so a visitor can't attribute
 * clicks to an arbitrary account, and internal ids never reach the browser.
 * Best-effort; never throws.
 *
 * Rate-limited per IP because it is callable by anyone: a server action is just
 * an HTTP endpoint, so without a cap a loop here writes unbounded rows and
 * turns the owner's click stats into fiction. The limit is checked BEFORE the
 * handle lookup so a flood costs no database work at all. */
export async function recordClick(handle: string, index: number): Promise<void> {
  if (!handle) return;
  const key = handle.toLowerCase();
  const ip = await clientIp();
  if (!consume(`link:click:${key}:${ip}`, LIMITS.linkClick.limit, LIMITS.linkClick.windowMs).ok) return;
  const brand = await brandByHandle(key);
  if (!brand) return;
  await recordLinkEvent(brand.orgId, brand.brandId, "click", String(index));
}
