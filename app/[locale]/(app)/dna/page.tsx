import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import type { ContentDna } from "@/lib/ai/prompts";

export default async function DnaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dna");
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");

  let dna: ContentDna | null = null;
  if (db) {
    const ctx = await currentContext();
    if (ctx) dna = await forOrg(db, ctx.orgId).currentDna(ctx.brandId);
  }

  if (!dna) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "clamp(40px,8vw,90px) clamp(16px,4vw,32px)", textAlign: "center", animation: "floatUp .4s ease" }}>
        <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, color: "var(--heading)" }}>{t("title")}</h1>
        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.8, marginBlock: "10px 22px" }}>{t("empty")}</p>
        <Link href="/onboarding/1" style={{ display: "inline-flex", alignItems: "center", height: 50, padding: "0 26px", borderRadius: 13, background: "linear-gradient(135deg,#102A43,#0B1F33)", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 12px 26px -12px rgba(11,31,51,.7)" }}>
          {t("emptyCta")}
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(24px,4vw,40px) clamp(16px,4vw,32px) 80px", animation: "floatUp .4s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
          <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, marginBlockStart: 6 }}>{t("subtitle")}</p>
        </div>
        <Link href="/studio" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 42, padding: "0 18px", borderRadius: 11, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--navy)", fontWeight: 600, fontSize: 13.5 }}>
          ↻ {t("regenerate")}
        </Link>
      </div>

      <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "clamp(16px,3vw,24px)", marginBlockStart: 20 }}>
        {dna.summary && <p style={{ fontSize: 14.5, color: "var(--slate)", lineHeight: 1.9, marginBlockEnd: 18 }}>{dna.summary}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
          <Field label={t("dialectLabel")}>
            <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 999, background: "var(--teal-tint)", color: "var(--teal-deep)", fontSize: 13, fontWeight: 600 }}>{dna.dialect || "—"}</span>
          </Field>
          <Field label={t("audienceLabel")}>
            <span style={{ fontSize: 14, color: "var(--slate)" }}>{dna.audience || "—"}</span>
          </Field>
        </div>

        <Field label={t("toneLabel")}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {dna.tone_traits.map((x, i) => <span key={i} style={{ padding: "5px 11px", borderRadius: 999, background: "var(--gold-tint)", color: "var(--gold-dark)", fontSize: 12.5, fontWeight: 600 }}>{x}</span>)}
          </div>
        </Field>

        <Field label={t("hooksLabel")}>
          <ul style={{ margin: 0, paddingInlineStart: 18, color: "var(--slate)", fontSize: 14, lineHeight: 2 }}>
            {dna.hook_patterns.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </Field>

        <Field label={t("completionLabel")}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(0, Math.min(100, dna.completion_pct))}%`, height: "100%", background: "linear-gradient(90deg,var(--teal),var(--teal-dark))" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--teal-deep)" }}>{nf.format(dna.completion_pct)}%</span>
          </div>
        </Field>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBlockStart: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--slate)", marginBlockEnd: 8 }}>{label}</div>
      {children}
    </div>
  );
}
