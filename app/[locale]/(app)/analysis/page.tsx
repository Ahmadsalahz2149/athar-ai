import { getTranslations, setRequestLocale } from "next-intl/server";

const split = (s: string) => s.split("|").map((x) => x.trim()).filter(Boolean);

function Section({ tint, color, title, children }: { tint: string; color: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "clamp(16px,3vw,24px)", marginBlockStart: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 14 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: tint }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: color }} />
        </span>
        <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--heading)" }}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default async function AnalysisPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Analysis");
  const ideas = split(t("ideas"));
  const quotes = split(t("quotes"));

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(24px,4vw,40px) clamp(16px,4vw,32px) 80px", animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, marginBlock: "6px 18px" }}>{t("subtitle")}</p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)" }}>
        <span style={{ padding: "5px 11px", borderRadius: 8, background: "var(--coral-tint)", color: "var(--coral)", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-latin)" }}>PDF</span>
        <div>
          <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 15 }}>{t("fileTitle")}</div>
          <div style={{ fontSize: 12.5, color: "var(--subtle)" }}>{t("fileMeta")}</div>
        </div>
      </div>

      <Section tint="var(--blue-tint)" color="var(--blue)" title={t("summaryLabel")}>
        <p style={{ fontSize: 14.5, color: "var(--slate)", lineHeight: 1.9 }}>{t("summary")}</p>
      </Section>

      <Section tint="var(--gold-tint)" color="var(--gold)" title={t("ideasLabel")}>
        <ul style={{ margin: 0, paddingInlineStart: 18, color: "var(--slate)", fontSize: 14.5, lineHeight: 2 }}>
          {ideas.map((i, k) => <li key={k}>{i}</li>)}
        </ul>
      </Section>

      <Section tint="var(--teal-tint)" color="var(--teal)" title={t("quotesLabel")}>
        <div style={{ display: "grid", gap: 12 }}>
          {quotes.map((q, k) => (
            <blockquote key={k} style={{ margin: 0, padding: "12px 16px", borderInlineStart: "3px solid var(--teal)", background: "var(--surface)", borderRadius: 10, fontSize: 14.5, color: "var(--slate)", lineHeight: 1.8 }}>
              «{q}»
            </blockquote>
          ))}
        </div>
      </Section>
    </main>
  );
}
