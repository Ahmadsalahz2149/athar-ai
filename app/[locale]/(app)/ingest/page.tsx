import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { IngestPanel } from "./IngestPanel";

const split = (s: string) => s.split(/[،,]/).map((x) => x.trim()).filter(Boolean);

export default async function IngestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Ingest");
  const dos = split(t("doItems"));
  const steps = split(t("pipeline"));

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "clamp(24px,4vw,40px) clamp(16px,4vw,32px) 80px", animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, marginBlock: "6px 24px" }}>{t("subtitle")}</p>

      <div className="col-2">
        <div>
          <IngestPanel />

          <div style={{ marginBlockStart: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 10 }}>{t("doLabel")}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {dos.map((it, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, background: "var(--card)", border: "1px solid var(--border)", fontSize: 14, color: "var(--slate)" }}>
                  <span style={{ width: 18, height: 18, borderRadius: 6, flex: "none", display: "grid", placeItems: "center", background: "var(--teal)" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  {it}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBlockStart: 24, padding: 16, borderRadius: 14, background: "var(--teal-tint-2)", border: "1px solid rgba(20,184,166,.3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: "var(--teal-deep)", fontWeight: 600 }}>{t("pasteCta")}</span>
            <Link href="/studio" style={{ display: "inline-flex", alignItems: "center", height: 42, padding: "0 20px", borderRadius: 11, background: "linear-gradient(135deg,#102A43,#0B1F33)", color: "#fff", fontWeight: 700, fontSize: 13.5 }}>{t("pasteBtn")}</Link>
          </div>
        </div>

        <aside style={{ background: "linear-gradient(160deg,#102A43,#0B1F33)", color: "#fff", borderRadius: 18, padding: 22, alignSelf: "start" }}>
          <div style={{ fontWeight: 700, marginBlockEnd: 16 }}>{t("pipelineTitle")}</div>
          <div style={{ display: "grid", gap: 14 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, flex: "none", display: "grid", placeItems: "center", background: "rgba(20,184,166,.18)", color: "var(--teal-light)", fontWeight: 700, fontSize: 13, fontFamily: "var(--font-latin)" }}>{i + 1}</span>
                <span style={{ fontSize: 13.5, color: "#E2E8F0", lineHeight: 1.6 }}>{s}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
