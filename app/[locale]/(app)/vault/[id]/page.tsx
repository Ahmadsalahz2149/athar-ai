import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { FileTypeBadge, kindToLabel, btnTeal, btnGhost } from "@/components/ui/display";
import { AnalyzeButton } from "./AnalyzeButton";
import { IdeasFromAnalysis } from "./IdeasFromAnalysis";

const OPP_TINTS = [
  { bg: "var(--gold-tint)", fg: "var(--gold-dark)" },
  { bg: "var(--teal-tint-2)", fg: "var(--teal-deep)" },
  { bg: "var(--coral-tint)", fg: "var(--coral)" },
  { bg: "var(--blue-tint)", fg: "var(--blue)" },
  { bg: "var(--border-3)", fg: "var(--slate-2)" },
];

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBlockEnd: 13, fontWeight: 700, color: "var(--heading)", fontSize: 15 }}>
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

export default async function AnalysisDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Analysis");
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const df = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { day: "numeric", month: "long", year: "numeric" });

  if (!db) notFound();
  const ctx = await currentContext();
  if (!ctx) notFound();
  const org = forOrg(db, ctx.orgId);
  const source = await org.getSource(ctx.brandId, id);
  if (!source) notFound();
  const row = await org.getAnalysis(ctx.brandId, id);
  const chunks = (await org.sourceChunkTexts(ctx.brandId, id, 200)).length;

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
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <Link href="/vault" style={{ fontSize: 13.5, color: "var(--teal-deep)", fontWeight: 600 }}>{t("backToVault")} ›</Link>

      {/* Navy hero */}
      <div style={{ marginBlockStart: 14, background: "linear-gradient(160deg,var(--navy-2),var(--navy))", color: "#fff", borderRadius: 18, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 13, minWidth: 0 }}>
            <span style={{ background: "#fff", borderRadius: 10, padding: 2 }}>
              <FileTypeBadge label={kindToLabel(source.kind, source.title)} size={38} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{source.title || t("untitled")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBlockStart: 8, fontSize: 12.5, color: "#9FB3C8" }}>
                <span>{t("metaType", { type: kindToLabel(source.kind, source.title) })}</span>
                <span>{t("metaUploaded", { date: df.format(new Date(source.createdAt)) })}</span>
                {a ? (
                  <span style={{ color: "var(--teal-light)", fontWeight: 700 }}>{t("metaComplete")}</span>
                ) : (
                  <span style={{ color: "var(--gold-dark)", fontWeight: 700 }}>{t("metaPending")}</span>
                )}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#9FB3C8" }}>{t("dnaImpact")}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--gold-dark)", fontFamily: "var(--font-latin)", marginBlockStart: 4 }}>
              {chunks > 0 ? `+${nf.format(Math.min(20, Math.max(1, Math.round(chunks / 2))))}%` : "—"}
            </div>
          </div>
        </div>
      </div>

      {!a ? (
        <div style={{ marginBlockStart: 22, textAlign: "center", padding: "44px 20px", border: "1px dashed var(--border-2)", borderRadius: 16, background: "var(--surface)" }}>
          <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockEnd: 6, fontSize: 16 }}>{t("notAnalyzedTitle")}</div>
          <div style={{ color: "var(--muted)", marginBlockEnd: 18 }}>{t("notAnalyzedBody")}</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <AnalyzeButton sourceId={id} hasAnalysis={false} />
          </div>
        </div>
      ) : (
        <div className="col-2" style={{ marginBlockStart: 20 }}>
          {/* MAIN */}
          <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
            <Card title={t("summary")} icon={<Dot c="var(--teal)" />}>
              <p style={{ fontSize: 14.5, color: "var(--slate)", lineHeight: 1.95 }}>{a.summary}</p>
            </Card>

            {a.keyIdeas.length > 0 && (
              <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBlockEnd: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 700, color: "var(--heading)", fontSize: 15 }}>
                    <Dot c="var(--gold)" />
                    {t("keyIdeas")}
                  </div>
                  <IdeasFromAnalysis sourceId={id} />
                </div>
                <div style={{ display: "grid", gap: 11 }}>
                  {a.keyIdeas.map((it, i) => (
                    <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                      <span style={{ width: 24, height: 24, flex: "none", borderRadius: 7, display: "grid", placeItems: "center", background: "var(--navy)", color: "#fff", fontSize: 12, fontWeight: 800, fontFamily: "var(--font-latin)" }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 14.5, color: "var(--slate)", lineHeight: 1.8 }}>{it}</span>
                      <Link href={`/studio?prompt=${encodeURIComponent(it)}`} style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-deep)", flex: "none", marginBlockStart: 3 }}>{t("writeThis")}</Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {a.quotes.length > 0 && (
              <Card title={t("quotes")} icon={<span style={{ color: "var(--gold-dark)", fontSize: 17, fontWeight: 800 }}>❞</span>}>
                <div style={{ display: "grid", gap: 10 }}>
                  {a.quotes.map((q, i) => (
                    <blockquote key={i} style={{ margin: 0, padding: "12px 16px", borderInlineStart: `3px solid ${i % 2 ? "var(--teal)" : "var(--gold)"}`, background: i % 2 ? "var(--teal-tint-2)" : "var(--gold-tint)", borderRadius: 10, fontSize: 14.5, color: "var(--slate)", lineHeight: 1.85 }}>
                      «{q}»
                    </blockquote>
                  ))}
                </div>
              </Card>
            )}

            {a.audience.length > 0 && (
              <Card title={t("audienceProblems")} icon={<Dot c="var(--coral)" />}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBlockEnd: 12 }}>{t("audienceHelper")}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {a.audience.map((p, i) => (
                    <span key={i} style={{ padding: "8px 14px", borderRadius: 999, border: "1px solid var(--border-2)", background: "var(--surface)", fontSize: 13, color: "var(--slate)" }}>
                      «{p}»
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* SIDE RAIL */}
          <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
            {a.opportunities.length > 0 && (
              <Card title={t("opportunities")}>
                <div style={{ display: "grid", gap: 8 }}>
                  {a.opportunities.slice(0, 6).map((o, i) => {
                    const tint = OPP_TINTS[i % OPP_TINTS.length];
                    return (
                      <Link key={i} href={`/studio?prompt=${encodeURIComponent(o)}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 13px", borderRadius: 11, background: tint.bg }}>
                        <span style={{ fontSize: 13.5, color: "var(--slate)", fontWeight: 600 }}>{o}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: tint.fg }}>›</span>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            )}

            <div style={{ background: "linear-gradient(160deg,var(--navy-2),var(--navy))", borderRadius: 16, padding: 18, display: "grid", gap: 9 }}>
              <Link href={`/studio?source=${id}`} style={{ ...btnTeal, width: "100%" }}>{t("turnIntoPosts")}</Link>
              <Link href={`/ideas?source=${id}`} style={{ ...btnGhost, width: "100%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)", color: "#fff" }}>{t("createCampaign")}</Link>
              <Link href="/dna" style={{ ...btnGhost, width: "100%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)", color: "#fff" }}>{t("addToDna")}</Link>
              <AnalyzeButton sourceId={id} hasAnalysis />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Dot({ c }: { c: string }) {
  return <span style={{ width: 9, height: 9, borderRadius: "50%", background: c, flex: "none" }} />;
}
