import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { AnalyzeButton } from "./AnalyzeButton";

function List({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <section style={{ marginBlockStart: 22, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBlockEnd: 12, fontWeight: 700, color: "var(--heading)" }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
        {title}
      </div>
      <ul style={{ display: "grid", gap: 8, paddingInlineStart: 18 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 14.5, color: "var(--slate)", lineHeight: 1.8 }}>{it}</li>
        ))}
      </ul>
    </section>
  );
}

export default async function AnalysisDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Analysis");

  if (!db) notFound();
  const ctx = await currentContext();
  if (!ctx) notFound();
  const org = forOrg(db, ctx.orgId);
  const source = await org.getSource(ctx.brandId, id);
  if (!source) notFound();
  const row = await org.getAnalysis(ctx.brandId, id);

  const a = row
    ? {
        summary: row.summary,
        keyIdeas: (row.keyIdeas as string[]) ?? [],
        quotes: (row.quotes as string[]) ?? [],
        audience: (row.audience as string[]) ?? [],
        opportunities: (row.opportunities as string[]) ?? [],
      }
    : null;

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(24px,4vw,40px) clamp(16px,4vw,32px) 80px", animation: "floatUp .4s ease" }}>
      <Link href="/vault" style={{ fontSize: 13.5, color: "var(--teal-deep)", fontWeight: 600 }}>← {t("backToVault")}</Link>

      <div style={{ marginBlockStart: 14, background: "linear-gradient(160deg,#102A43,#0B1F33)", color: "#fff", borderRadius: 18, padding: 22 }}>
        <div style={{ fontSize: 12, color: "var(--teal-light)", fontWeight: 700 }}>{t("source")}</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBlockStart: 4 }}>{source.title || t("untitled")}</div>
      </div>

      {!a ? (
        <div style={{ marginBlockStart: 22, textAlign: "center", padding: "40px 20px", border: "1px dashed var(--border-2)", borderRadius: 16, background: "var(--surface)" }}>
          <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockEnd: 6 }}>{t("notAnalyzedTitle")}</div>
          <div style={{ color: "var(--muted)", marginBlockEnd: 18 }}>{t("notAnalyzedBody")}</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <AnalyzeButton sourceId={id} hasAnalysis={false} />
          </div>
        </div>
      ) : (
        <>
          <section style={{ marginBlockStart: 22, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
            <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockEnd: 10 }}>{t("summary")}</div>
            <p style={{ fontSize: 15, color: "var(--slate)", lineHeight: 1.9 }}>{a.summary}</p>
          </section>
          <List title={t("keyIdeas")} items={a.keyIdeas} color="var(--teal)" />
          {a.quotes.length > 0 && (
            <section style={{ marginBlockStart: 22, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
              <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockEnd: 12 }}>{t("quotes")}</div>
              <div style={{ display: "grid", gap: 10 }}>
                {a.quotes.map((q, i) => (
                  <blockquote key={i} style={{ margin: 0, padding: "12px 16px", borderInlineStart: "3px solid var(--gold)", background: "var(--gold-tint)", borderRadius: 10, fontSize: 14.5, color: "var(--slate)", lineHeight: 1.8 }}>“{q}”</blockquote>
                ))}
              </div>
            </section>
          )}
          <List title={t("audienceProblems")} items={a.audience} color="var(--coral)" />
          <List title={t("opportunities")} items={a.opportunities} color="var(--gold)" />
          <div style={{ marginBlockStart: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/studio" style={{ display: "inline-flex", height: 44, alignItems: "center", padding: "0 22px", borderRadius: 12, background: "var(--teal)", color: "#fff", fontWeight: 700 }}>{t("turnIntoPosts")}</Link>
            <AnalyzeButton sourceId={id} hasAnalysis />
          </div>
        </>
      )}
    </main>
  );
}
