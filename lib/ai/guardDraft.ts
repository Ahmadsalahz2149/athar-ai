import "server-only";
import { forOrg, type Db } from "@/lib/db/forOrg";
import { checkContent } from "./guardrails";

/**
 * Server-side content guardrail for a persisted draft.
 *
 * The Studio screen runs `checkContent` in the browser and disables its publish
 * control, but that is advisory only: a server action can be invoked directly,
 * so nothing stopped a draft with leaked secrets/PII from being pushed straight
 * to pending/approved/scheduled. Enforce the same scan here, on the transitions
 * that move a draft toward publication, reading the text from the DB rather
 * than trusting anything the caller sends.
 */
export async function guardDraft(
  db: Db,
  orgId: string,
  brandId: string,
  draftId: string,
): Promise<{ ok: boolean; violations: string[] }> {
  const d = await forOrg(db, orgId).draftText(brandId, draftId);
  if (!d) return { ok: true, violations: [] }; // not ours / nothing stored to scan
  return checkContent(d.text);
}
