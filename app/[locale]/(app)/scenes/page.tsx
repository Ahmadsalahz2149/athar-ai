import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { hasVideoKey } from "@/lib/ai/video";
import { ScenesClient, type SceneAsset } from "./ScenesClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ScenesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Scenes");

  let assets: SceneAsset[] = [];
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const ma = await org.listMediaAssets(ctx.brandId);
      assets = ma.filter((a) => a.kind === "video").map((a) => ({ id: a.id, url: a.url, prompt: a.prompt, createdAt: a.createdAt.toISOString() }));
    }
  }

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <h1 className="headline-gradient" style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", marginBlock: "6px 20px", maxWidth: 680 }}>{t("subtitle")}</p>
      <ScenesClient assets={assets} keys={hasVideoKey()} locale={locale} />
    </main>
  );
}
