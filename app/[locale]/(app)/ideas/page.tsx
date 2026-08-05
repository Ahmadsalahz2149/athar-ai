import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { IdeasClient } from "./IdeasClient";

// Give the batch-generation server action room on Vercel.
export const maxDuration = 60;

export default async function IdeasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Ideas");

  let ideas: { id: string; title: string; angle: string | null; category: string | null; bucket: string; postScore: number; status: string }[] = [];
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const rows = await forOrg(db, ctx.orgId).listIdeas(ctx.brandId, { limit: 60 });
      ideas = rows.map((r) => ({ id: r.id, title: r.title, angle: r.angle, category: r.category, bucket: r.bucket, postScore: r.postScore, status: r.status }));
    }
  }

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBlockEnd: 4 }}>
        <div>
          <h1 style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
          <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.7, marginBlockStart: 6 }}>{t("subtitle")}</p>
        </div>
      </div>
      <IdeasClient ideas={ideas} />
    </main>
  );
}
