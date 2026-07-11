import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";

const KIND_TINT: Record<string, string> = {
  text: "var(--blue-tint)",
  audio: "var(--teal-tint)",
  video: "var(--gold-tint)",
  pdf: "var(--coral-tint)",
  url: "var(--teal-tint-2)",
};

export default async function VaultPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Vault");

  let sources: Awaited<ReturnType<ReturnType<typeof forOrg>["listSources"]>> = [];
  if (db) {
    const ctx = await currentContext();
    if (ctx) sources = await forOrg(db, ctx.orgId).listSources(ctx.brandId);
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "clamp(24px,4vw,40px) clamp(16px,4vw,32px) 80px", animation: "floatUp .4s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
          <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, marginBlockStart: 6 }}>{t("subtitle")}</p>
        </div>
        <Link href="/ingest" style={{ display: "inline-flex", alignItems: "center", height: 42, padding: "0 18px", borderRadius: 11, background: "linear-gradient(135deg,#102A43,#0B1F33)", color: "#fff", fontWeight: 700, fontSize: 13.5 }}>+ {t("addSource")}</Link>
      </div>

      {sources.length === 0 ? (
        <div style={{ marginBlockStart: 28, textAlign: "center", padding: "60px 20px", border: "1px dashed var(--border-2)", borderRadius: 18, background: "var(--surface)" }}>
          <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 17 }}>{t("emptyTitle")}</div>
          <div style={{ color: "var(--muted)", marginBlock: "8px 18px" }}>{t("emptyBody")}</div>
          <Link href="/ingest" style={{ display: "inline-flex", height: 42, alignItems: "center", padding: "0 20px", borderRadius: 11, background: "var(--teal)", color: "#fff", fontWeight: 700 }}>{t("addSource")}</Link>
        </div>
      ) : (
        <div style={{ marginBlockStart: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16 }}>
          {sources.map((s) => (
            <Link key={s.id} href={`/vault/${s.id}`} style={{ display: "block", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: KIND_TINT[s.kind] ?? "var(--teal-tint)", color: "var(--navy)" }}>{t(`kind_${s.kind}`)}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: s.analyzed ? "var(--teal-tint-2)" : "var(--gold-tint)", color: s.analyzed ? "var(--teal-deep)" : "var(--gold-dark)" }}>
                  {s.analyzed ? t("analyzed") : t("needsAnalysis")}
                </span>
              </div>
              <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockStart: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title || t("untitled")}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginBlockStart: 6 }}>{t("chunks", { n: s.chunks })}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
