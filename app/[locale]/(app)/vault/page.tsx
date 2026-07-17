import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { kindToLabel, btnTeal } from "@/components/ui/display";
import { VaultClient, type VaultSource } from "./VaultClient";

export default async function VaultPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Vault");

  let sources: VaultSource[] = [];
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const rows = await forOrg(db, ctx.orgId).listSources(ctx.brandId);
      sources = rows.map((s) => ({
        id: s.id,
        kind: s.kind,
        title: s.title,
        label: kindToLabel(s.kind, s.title),
        chunks: s.ideas || s.chunks, // "فكرة" = extracted ideas; falls back to chunks pre-analysis
        drafts: s.drafts,
        analyzed: s.analyzed,
        createdAt: s.createdAt.toISOString(),
        language: s.language,
        category: s.category,
        summary: s.summary,
      }));
    }
  }

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
          <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.7, marginBlockStart: 6 }}>{t("subtitle")}</p>
        </div>
        <Link href="/ingest" style={btnTeal}>+ {t("addSource")}</Link>
      </div>

      <VaultClient sources={sources} />
    </main>
  );
}
