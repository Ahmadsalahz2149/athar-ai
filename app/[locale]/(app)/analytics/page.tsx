import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { AnalyticsClient } from "./AnalyticsClient";

export default async function AnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Analytics");

  let topPosts: { hook: string; platform: string; score: number }[] = [];
  let hasContent = false;
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const rows = await forOrg(db, ctx.orgId).listDraftsByStatus(ctx.brandId);
      hasContent = rows.length > 0;
      topPosts = rows
        .filter((r) => ["scheduled", "approved", "published"].includes(r.status))
        .sort((a, b) => b.postScore - a.postScore)
        .slice(0, 3)
        .map((r) => ({ hook: r.hook, platform: r.platform, score: r.postScore }));
    }
  }

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.7, marginBlock: "6px 14px" }}>{t("subtitle")}</p>
      <AnalyticsClient topPosts={topPosts} hasContent={hasContent} />
    </main>
  );
}
