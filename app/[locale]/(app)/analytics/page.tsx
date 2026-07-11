import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// NOTE: real numbers require social publishing + platform analytics (OAuth) —
// «يحتاج تدخّل». Until then this screen shows clearly-labelled sample data so the
// layout, insight loop, and DNA hand-off are all in place.
const SAMPLE_BARS = [40, 62, 55, 78, 90, 72, 84];

export default async function AnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Analytics");
  const max = Math.max(...SAMPLE_BARS);

  const kpis = [
    { label: t("reach"), value: "12.4K", delta: "+8%" },
    { label: t("engagement"), value: "3.1K", delta: "+14%" },
    { label: t("followers"), value: "+284", delta: "+5%" },
    { label: t("rate"), value: "6.2%", delta: "+1.1%" },
  ];

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "clamp(24px,4vw,40px) clamp(16px,4vw,32px) 80px", animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, marginBlock: "6px 14px" }}>{t("subtitle")}</p>

      <div style={{ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 999, background: "var(--gold-tint)", color: "var(--gold-dark)", marginBlockEnd: 18 }}>
        ⚠ {t("sampleBadge")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--heading)", fontFamily: "var(--font-latin)" }}>{k.value}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBlock: "4px 2px" }}>{k.label}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>{k.delta}</div>
          </div>
        ))}
      </div>

      <section style={{ marginBlockStart: 20, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
        <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockEnd: 16 }}>{t("engagementOverTime")}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 160 }}>
          {SAMPLE_BARS.map((b, i) => (
            <div key={i} style={{ flex: 1, height: `${(b / max) * 100}%`, background: "linear-gradient(180deg,var(--teal),var(--teal-dark))", borderRadius: "6px 6px 0 0", minWidth: 10 }} />
          ))}
        </div>
      </section>

      <div style={{ marginBlockStart: 20, background: "linear-gradient(160deg,#102A43,#0B1F33)", color: "#fff", borderRadius: 18, padding: 24 }}>
        <div style={{ fontSize: 12.5, color: "var(--teal-light)", fontWeight: 700 }}>✦ {t("insightTitle")}</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBlock: "8px 16px", lineHeight: 1.7 }}>{t("insightBody")}</div>
        <Link href="/dna" style={{ display: "inline-flex", height: 42, alignItems: "center", padding: "0 20px", borderRadius: 11, background: "var(--teal)", color: "#fff", fontWeight: 700, fontSize: 13.5 }}>{t("updateDna")}</Link>
      </div>
    </main>
  );
}
