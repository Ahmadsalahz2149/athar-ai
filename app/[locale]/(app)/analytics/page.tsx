import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { StatCard, StatusPill, EmptyState, btnNavy } from "@/components/ui/display";

export const dynamic = "force-dynamic";

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 };
const cardTitle: React.CSSProperties = { fontWeight: 700, color: "var(--heading)", fontSize: 15, marginBlockEnd: 14 };

export default async function AnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Analytics");
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");

  let counts = { sources: 0, ideas: 0, drafts: 0, writing: 0, pending: 0, scheduled: 0, published: 0 };
  let weekly: { week: string; n: number }[] = [];
  let usage: { reason: string; spent: number }[] = [];
  let dnaGrowth: { version: number; pct: number }[] = [];
  let linkStats = { views: 0, clicks: 0 };
  let dnaPct = 0;
  let topPosts: { hook: string; platform: string; score: number }[] = [];

  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const [c, w, u, g, ls, dna, drafts] = await Promise.all([
        org.counts(ctx.brandId),
        org.weeklyContent(ctx.brandId, 8),
        org.creditUsage(),
        org.dnaGrowth(ctx.brandId),
        org.linkStats(ctx.brandId),
        org.currentDna(ctx.brandId),
        org.listDraftsByStatus(ctx.brandId),
      ]);
      counts = c; weekly = w; usage = u.slice(0, 8); dnaGrowth = g; linkStats = ls;
      dnaPct = dna?.completion_pct ?? 0;
      topPosts = drafts.filter((r) => r.hook).sort((a, b) => b.postScore - a.postScore).slice(0, 3).map((r) => ({ hook: r.hook, platform: r.platform, score: r.postScore }));
    }
  }

  const totalContent = counts.ideas + counts.drafts;
  const funnel = [
    { label: t("fIdeas"), n: counts.ideas, c: "var(--gold)" },
    { label: t("fDrafts"), n: counts.drafts, c: "var(--blue)" },
    { label: t("fPending"), n: counts.pending, c: "var(--coral)" },
    { label: t("fScheduled"), n: counts.scheduled, c: "var(--teal)" },
    { label: t("fPublished"), n: counts.published, c: "var(--teal-deep)" },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.n));
  const weekMax = Math.max(1, ...weekly.map((w) => w.n));
  const usageMax = Math.max(1, ...usage.map((u) => u.spent));
  const usageLabel = (r: string) => { const k = `u_${r}`; const v = t(k); return v === k ? r : v; };

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <h1 className="headline-gradient" style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", marginBlock: "6px 6px" }}>{t("subtitle")}</p>
      <StatusPill tone="teal" dot>{t("realData")}</StatusPill>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,168px),1fr))", gap: 14, marginBlockStart: 18 }}>
        <StatCard label={t("kContent")} value={nf.format(totalContent)} tint="var(--blue-tint)" />
        <StatCard label={t("kPublished")} value={nf.format(counts.published + counts.scheduled)} tint="var(--teal-tint)" />
        <StatCard label={t("kDna")} value={`${nf.format(dnaPct)}%`} tint="var(--gold-tint)" />
        <StatCard label={t("kLinkViews")} value={nf.format(linkStats.views)} tint="var(--coral-tint)" />
      </div>

      <div className="col2 wide-first" style={{ marginBlockStart: 18 }}>
        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          {/* Velocity bar chart */}
          <section style={card}>
            <div style={cardTitle}>{t("velocityTitle")}</div>
            {weekly.length === 0 ? (
              <p style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", padding: "20px 0" }}>{t("velocityEmpty")}</p>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 150, paddingBlockStart: 10 }}>
                {weekly.map((w, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>{nf.format(w.n)}</span>
                    <div title={`${w.n}`} style={{ width: "100%", maxWidth: 34, height: `${Math.max(4, (w.n / weekMax) * 100)}%`, background: i === weekly.length - 1 ? "var(--teal)" : "var(--teal-tint-2,#cdeee8)", borderRadius: "6px 6px 0 0", minHeight: 4 }} />
                    <span style={{ fontSize: 9.5, color: "var(--subtle)", fontFamily: "var(--font-latin)" }}>{w.week.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Credit usage */}
          <section style={card}>
            <div style={cardTitle}>{t("usageTitle")}</div>
            {usage.length === 0 ? (
              <p style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t("usageEmpty")}</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {usage.map((u, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBlockEnd: 4 }}>
                      <span style={{ color: "var(--slate)", fontWeight: 600 }}>{usageLabel(u.reason)}</span>
                      <span style={{ color: "var(--muted)", fontFamily: "var(--font-latin)" }}>{nf.format(u.spent)}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 5, background: "var(--border-3,#eef1f5)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(u.spent / usageMax) * 100}%`, background: "var(--gold)", borderRadius: 5 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          {/* Funnel */}
          <section style={card}>
            <div style={cardTitle}>{t("funnelTitle")}</div>
            <div style={{ display: "grid", gap: 10 }}>
              {funnel.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12.5, color: "var(--slate)", width: 62, flexShrink: 0 }}>{f.label}</span>
                  <div style={{ flex: 1, height: 22, borderRadius: 6, background: "var(--border-3,#eef1f5)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(3, (f.n / funnelMax) * 100)}%`, background: f.c, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingInline: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", fontFamily: "var(--font-latin)" }}>{f.n > 0 ? nf.format(f.n) : ""}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* DNA growth */}
          <section style={card}>
            <div style={cardTitle}>{t("dnaGrowthTitle")}</div>
            {dnaGrowth.length === 0 ? (
              <p style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t("dnaGrowthEmpty")}</p>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
                {dnaGrowth.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>{d.pct}%</span>
                    <div style={{ width: "100%", maxWidth: 26, height: `${Math.max(6, d.pct)}%`, background: i === dnaGrowth.length - 1 ? "var(--teal)" : "var(--teal-tint-2,#cdeee8)", borderRadius: "5px 5px 0 0" }} />
                    <span style={{ fontSize: 9, color: "var(--subtle)", fontFamily: "var(--font-latin)" }}>{t("version")}{d.version}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Top posts */}
          <section style={card}>
            <div style={cardTitle}>{t("topPosts")}</div>
            {topPosts.length === 0 ? (
              <p style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", padding: "12px 0" }}>{t("noTopPosts")}</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {topPosts.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "var(--teal-deep)", fontFamily: "var(--font-latin)", flexShrink: 0 }}>{nf.format(p.score)}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.8, color: "var(--heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.hook}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {totalContent === 0 && (
        <div style={{ marginBlockStart: 18 }}>
          <EmptyState title={t("velocityEmpty")} body="" cta={<Link href="/studio" style={btnNavy}>{t("fDrafts")}</Link>} />
        </div>
      )}
    </main>
  );
}
