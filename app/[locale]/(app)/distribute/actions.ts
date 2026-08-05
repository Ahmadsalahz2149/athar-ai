"use server";

import { revalidatePath } from "next/cache";
import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/json";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { estimateAudience } from "@/lib/credits/costs";
import { AUDIENCE_SYSTEM, AUDIENCE_SCHEMA, buildAudienceMessage, buildBrandContext } from "@/lib/ai/prompts";
import { normalizeKit, type DistributionKit } from "@/lib/distribution/types";

type Res<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function ctxOrThrow() {
  if (!db) throw new Error("no_db");
  const ctx = await currentContext();
  if (!ctx) throw new Error("no_session");
  return { db, ctx };
}

/** Analyze the target audience and generate group-search keywords/queries from
 * the DNA + brand profile + products, then cache the kit on the brand. */
export async function generateAudience(): Promise<Res<{ kit: DistributionKit }>> {
  try {
    const provider = currentProvider();
    if (!hasKeyFor(provider)) return { ok: false, error: "no_key" };
    const { db, ctx } = await ctxOrThrow();
    const t = forOrg(db, ctx.orgId);
    const dna = await t.currentDna(ctx.brandId);
    if (!dna) return { ok: false, error: "no_dna" };

    const estimate = estimateAudience();
    if ((await t.balance()) < estimate) return { ok: false, error: "insufficient_credits" };

    let brand: string | undefined;
    try {
      const [profile, products] = await Promise.all([t.getBrandProfile(ctx.brandId), t.listProducts(ctx.brandId)]);
      brand = buildBrandContext({ profile, products }) || undefined;
    } catch {
      /* best-effort */
    }

    const res = await generateText({
      system: AUDIENCE_SYSTEM,
      user: buildAudienceMessage({ dna, brand }),
      maxTokens: 2048,
      anthropicModel: process.env.ANTHROPIC_DRAFT_MODEL || MODELS.SONNET,
      schema: AUDIENCE_SCHEMA,
      provider,
    });
    if (res.truncated) return { ok: false, error: "failed" };

    const parsed = extractJson<unknown>(res.text);
    const kit = normalizeKit({ ...(parsed as object), generatedAt: new Date().toISOString() });
    if (!kit.audience.summary && kit.keywords.length === 0) return { ok: false, error: "failed" };

    await t.setDistribution(ctx.brandId, kit);
    await t.debit(estimate, "distribution_audience", "brand", ctx.brandId);
    revalidatePath("/distribute");
    return { ok: true, data: { kit } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function saveGroup(g: {
  id?: string;
  platform?: string;
  name: string;
  url?: string | null;
  memberCount?: number | null;
  rules?: string | null;
  status?: string;
  cadenceDays?: number;
  notes?: string | null;
}): Promise<Res<{ id: string }>> {
  try {
    if (!g.name?.trim()) return { ok: false, error: "name_required" };
    const { db, ctx } = await ctxOrThrow();
    const id = await forOrg(db, ctx.orgId).saveGroup(ctx.brandId, g);
    revalidatePath("/distribute");
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteGroup(groupId: string): Promise<Res> {
  try {
    const { db, ctx } = await ctxOrThrow();
    await forOrg(db, ctx.orgId).deleteGroup(ctx.brandId, groupId);
    revalidatePath("/distribute");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Record a post shared to a group now (updates cadence + last-posted). */
export async function markGroupPosted(groupId: string): Promise<Res> {
  try {
    const { db, ctx } = await ctxOrThrow();
    await forOrg(db, ctx.orgId).markGroupPosted(ctx.brandId, groupId);
    revalidatePath("/distribute");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
