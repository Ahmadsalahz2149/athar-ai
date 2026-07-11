import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { IdeasClient } from "./IdeasClient";

export default async function IdeasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Ideas");

  let ideas: { id: string; title: string; angle: string | null; postScore: number; status: string }[] = [];
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const rows = await forOrg(db, ctx.orgId).listIdeas(ctx.brandId, { limit: 60 });
      ideas = rows.map((r) => ({ id: r.id, title: r.title, angle: r.angle, postScore: r.postScore, status: r.status }));
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "clamp(24px,4vw,40px) clamp(16px,4vw,32px) 80px", animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, marginBlock: "6px 22px" }}>{t("subtitle")}</p>
      <IdeasClient ideas={ideas} />
    </main>
  );
}
