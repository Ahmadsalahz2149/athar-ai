import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db/forOrg";
import { asSystem } from "@/lib/db/rls";

/**
 * Which workspace does a Stripe customer belong to? (Phase 8)
 *
 * Cross-org by necessity: this runs in the webhook, where the org is what we
 * are trying to find — there is no tenant context to scope to yet, so the
 * tenancy façade cannot express it. Like the job queue and the publish
 * dispatcher, it therefore uses `db.execute` directly, and it is deliberately
 * narrow: one id in, one id out, no tenant data crosses it.
 *
 * Needed because a one-off credit-pack invoice carries no subscription
 * metadata. Metadata is still tried first by the caller; this is the fallback.
 */
export async function orgIdForStripeCustomer(db: Db, customerId: string): Promise<string | null> {
  if (!customerId) return null;
  // Cross-org by definition: the org is what we are looking for.
  const rows = await asSystem(db, (tx) => tx.execute(sql`
    SELECT id FROM organizations WHERE stripe_customer_id = ${customerId} LIMIT 1
  `));
  const list = rows as unknown as { id: string }[];
  return list[0]?.id ?? null;
}
