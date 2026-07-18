"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { normalizeDna } from "@/lib/ai/normalize";
import type { ContentDna } from "@/lib/ai/prompts";

/** The subset of DNA the user can edit by hand. Everything else is carried over
 * from the current version; saving creates a NEW version (history is preserved). */
export type DnaEdits = {
  tone_traits: string[];
  dialect: string;
  explanation_style: string;
  dos: string[];
  donts: string[];
  hook_patterns: string[];
  cta_patterns: string[];
  pillars: ContentDna["pillars"];
};

export async function saveDnaEdits(edits: DnaEdits): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!db) return { ok: false, error: "no_session" };
    const ctx = await currentContext();
    if (!ctx) return { ok: false, error: "no_session" };

    const t = forOrg(db, ctx.orgId);
    const current = await t.currentDna(ctx.brandId);
    if (!current) return { ok: false, error: "no_dna" };

    const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean).slice(0, 12);
    const merged = normalizeDna({
      ...current,
      tone_traits: clean(edits.tone_traits),
      dialect: edits.dialect.trim(),
      explanation_style: edits.explanation_style.trim(),
      dos: clean(edits.dos),
      donts: clean(edits.donts),
      hook_patterns: clean(edits.hook_patterns),
      cta_patterns: clean(edits.cta_patterns),
      pillars: edits.pillars,
    });

    await t.saveDna(ctx.brandId, merged);
    revalidatePath("/[locale]/(app)/dna", "page");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}
