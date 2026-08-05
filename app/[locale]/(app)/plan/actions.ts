"use server";

import { revalidatePath } from "next/cache";
import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/json";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { estimatePlan } from "@/lib/credits/costs";
import { PLAN_SYSTEM, PLAN_SCHEMA, buildPlanMessage, buildBrandContext } from "@/lib/ai/prompts";
import { normalizePlan, type MonthlyPlan } from "@/lib/plan/types";
import { daysInMonth } from "@/lib/plan/worldDays";

/** Generate (or regenerate) the monthly content plan + trends for `month`
 * ('YYYY-MM') from the brand's DNA + profile + products + the month's occasions. */
export async function generateMonthlyPlan(month: string): Promise<{ ok: true; plan: MonthlyPlan } | { ok: false; error: string }> {
  try {
    const provider = currentProvider();
    if (!hasKeyFor(provider)) return { ok: false, error: "no_key" };
    if (!db) return { ok: false, error: "no_session" };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };
    if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "bad_month" };

    const t = forOrg(db, ctx.orgId);
    const dna = await t.currentDna(ctx.brandId);
    if (!dna) return { ok: false, error: "no_dna" };
    if ((await t.balance()) < estimatePlan()) return { ok: false, error: "insufficient_credits" };

    const [y, m] = month.split("-").map(Number);
    const dim = new Date(y, m, 0).getDate();
    const monthName = new Intl.DateTimeFormat("ar", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
    const occasions = daysInMonth(m).map((d) => `${d.day}: ${d.ar}`).join("\n") || undefined;

    let brand: string | undefined;
    try {
      const [profile, products] = await Promise.all([t.getBrandProfile(ctx.brandId), t.listProducts(ctx.brandId)]);
      brand = buildBrandContext({ profile, products }) || undefined;
    } catch {
      /* best-effort */
    }

    const res = await generateText({
      system: PLAN_SYSTEM,
      user: buildPlanMessage({ dna, brand, monthName, daysInMonth: dim, count: 20, occasions }),
      maxTokens: 4096,
      anthropicModel: process.env.ANTHROPIC_DRAFT_MODEL || MODELS.SONNET,
      schema: PLAN_SCHEMA,
      provider,
    });
    if (res.truncated) return { ok: false, error: "failed" };

    const plan = normalizePlan({ ...(extractJson<object>(res.text) as object), generatedAt: new Date().toISOString() });
    if (!plan.plan.length) return { ok: false, error: "failed" };

    await t.savePlan(ctx.brandId, month, plan);
    await t.debit(estimatePlan(), "monthly_plan", "brand", ctx.brandId);
    revalidatePath("/plan");
    return { ok: true, plan };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Dismiss a smart suggestion by key (Phase 2 #19). */
export async function dismissSuggestion(key: string): Promise<{ ok: boolean }> {
  try {
    if (!db) return { ok: false };
    const ctx = await currentContext();
    if (!ctx) return { ok: false };
    await forOrg(db, ctx.orgId).dismissSuggestion(ctx.brandId, key);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
