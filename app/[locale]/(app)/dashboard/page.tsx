import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";

function Radial({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <svg width="66" height="66" viewBox="0 0 66 66">
      <circle cx="33" cy="33" r={r} fill="none" stroke="var(--border-2)" strokeWidth="6" />
      <circle cx="33" cy="33" r={r} fill="none" stroke="var(--teal)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 33 33)" />
      <text x="33" y="38" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--heading)" fontFamily="var(--font-latin)">{pct}%</text>
    </svg>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent ?? "var(--heading)", fontFamily: "var(--font-latin)" }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBlockStart: 4 }}>{label}</div>
    </div>
  );
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dashboard");
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");

  let counts = { sources: 0, ideas: 0, drafts: 0, pending: 0, scheduled: 0 };
  let completeness = 0;
  let ideas: Awaited<ReturnType<ReturnType<typeof forOrg>["listIdeas"]>> = [];
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const [c, dna, ii] = await Promise.all([
        org.counts(ctx.brandId),
        org.currentDna(ctx.brandId),
        org.listIdeas(ctx.brandId, { limit: 3 }),
      ]);
      counts = c;
      completeness = dna?.completion_pct ?? 0;
      ideas = ii;
    }
  }

  // Rule-based next-best-action (AI upgrade later).
  const rec =
    counts.sources === 0
      ? { body: t("recNoSources"), cta: t("recUpload"), href: "/ingest" }
      : completeness < 40
        ? { body: t("recBuildDna"), cta: t("recStudio"), href: "/studio" }
        : counts.drafts === 0
          ? { body: t("recWrite"), cta: t("recStudio"), href: "/studio" }
          : { body: t("recReview"), cta: t("recApprovals"), href: "/approvals" };

  const funnel = [
    { label: t("fIdeas"), n: counts.ideas },
    { label: t("fWriting"), n: counts.drafts },
    { label: t("fReview"), n: counts.pending },
    { label: t("fScheduled"), n: counts.scheduled },
  ];
  const max = Math.max(1, ...funnel.map((f) => f.n));

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(24px,4vw,40px) clamp(16px,4vw,32px) 80px", animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("greeting")}</h1>
      <p style={{ fontSize: 15, color: "var(--muted)", marginBlock: "6px 22px" }}>{t("subtitle")}</p>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <Radial pct={completeness} />
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("kpiDna")}</div>
        </div>
        <Kpi label={t("kpiSources")} value={nf.format(counts.sources)} />
        <Kpi label={t("kpiIdeas")} value={nf.format(counts.ideas)} accent="var(--teal-deep)" />
        <Kpi label={t("kpiPending")} value={nf.format(counts.pending)} accent="var(--gold-dark)" />
        <Kpi label={t("kpiScheduled")} value={nf.format(counts.scheduled)} />
      </div>

      {/* Recommendation hero */}
      <div style={{ marginBlockStart: 20, background: "linear-gradient(160deg,#102A43,#0B1F33)", color: "#fff", borderRadius: 18, padding: 24 }}>
        <div style={{ fontSize: 12.5, color: "var(--teal-light)", fontWeight: 700 }}>✦ {t("recTitle")}</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBlock: "8px 16px", lineHeight: 1.7 }}>{rec.body}</div>
        <Link href={rec.href} style={{ display: "inline-flex", height: 42, alignItems: "center", padding: "0 20px", borderRadius: 11, background: "var(--teal)", color: "#fff", fontWeight: 700, fontSize: 13.5 }}>{rec.cta}</Link>
      </div>

      <div style={{ marginBlockStart: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
        {/* Pipeline funnel */}
        <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
          <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockEnd: 14 }}>{t("pipeline")}</div>
          <div style={{ display: "grid", gap: 12 }}>
            {funnel.map((f) => (
              <div key={f.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--slate)", marginBlockEnd: 5 }}>
                  <span>{f.label}</span>
                  <span style={{ fontFamily: "var(--font-latin)", fontWeight: 700 }}>{nf.format(f.n)}</span>
                </div>
                <div style={{ height: 8, borderRadius: 8, background: "var(--border-3)", overflow: "hidden" }}>
                  <div style={{ width: `${(f.n / max) * 100}%`, height: "100%", background: "linear-gradient(90deg,var(--teal),var(--teal-dark))" }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Suggested ideas / quick actions */}
        <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
          <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockEnd: 14 }}>{t("suggested")}</div>
          {ideas.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {ideas.map((i) => (
                <Link key={i.id} href="/ideas" style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "11px 14px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 14, color: "var(--slate)" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</span>
                  <span style={{ fontFamily: "var(--font-latin)", fontWeight: 700, color: "var(--teal-deep)" }}>{nf.format(i.postScore)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <Link href="/ingest" style={qa}>{t("qaUpload")}</Link>
              <Link href="/ideas" style={qa}>{t("qaIdeas")}</Link>
              <Link href="/studio" style={qa}>{t("qaStudio")}</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const qa: React.CSSProperties = {
  display: "block",
  padding: "12px 14px",
  borderRadius: 12,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--slate)",
};
