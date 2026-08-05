import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { EMPTY_KIT, type DistributionKit } from "@/lib/distribution/types";
import { DistributeClient, type GroupView, type ReadyPost } from "./DistributeClient";

export default async function DistributePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Distribute");

  let kit: DistributionKit = EMPTY_KIT;
  let groups: GroupView[] = [];
  let posts: ReadyPost[] = [];
  let hasDna = false;

  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const [k, g, drafts, dna] = await Promise.all([
        org.getDistribution(ctx.brandId),
        org.listGroups(ctx.brandId),
        org.listDrafts(ctx.brandId, 25),
        org.currentDna(ctx.brandId),
      ]);
      kit = k;
      hasDna = !!dna;
      groups = g.map((x) => ({
        id: x.id,
        platform: x.platform,
        name: x.name,
        url: x.url,
        memberCount: x.memberCount,
        rules: x.rules,
        status: x.status,
        cadenceDays: x.cadenceDays,
        notes: x.notes,
        lastPostedAt: x.lastPostedAt ? x.lastPostedAt.toISOString() : null,
      }));
      posts = drafts
        .filter((d) => (d.hook || d.body))
        .map((d) => ({ id: d.id, platform: d.platform, hook: d.hook, body: d.body, status: d.status }));
    }
  }

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <h1 className="headline-gradient" style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, letterSpacing: "-.4px" }}>
        {t("title")}
      </h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", marginBlock: "6px 20px", maxWidth: 680 }}>{t("subtitle")}</p>
      <DistributeClient kit={kit} groups={groups} posts={posts} hasDna={hasDna} locale={locale} />
    </main>
  );
}
