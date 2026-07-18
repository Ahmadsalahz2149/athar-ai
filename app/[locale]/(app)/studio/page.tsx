import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { kindToLabel } from "@/components/ui/display";
import { StudioClient } from "./StudioClient";
import type { StudioSource } from "./actions";

export default async function StudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  let sources: StudioSource[] = [];
  let tones: string[] = [];
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const [rows, dna] = await Promise.all([org.listSources(ctx.brandId), org.currentDna(ctx.brandId)]);
      sources = rows.map((s) => ({ id: s.id, title: s.title || kindToLabel(s.kind, s.title), label: kindToLabel(s.kind, s.title) }));
      tones = dna?.tone_traits ?? [];
    }
  }

  return <StudioClient sources={sources} tones={tones} />;
}
