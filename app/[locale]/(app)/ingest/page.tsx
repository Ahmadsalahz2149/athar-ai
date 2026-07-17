import { getTranslations, setRequestLocale } from "next-intl/server";
import { IngestPanel } from "./IngestPanel";
import { NumberedStepper, IconTile } from "@/components/ui/display";

export default async function IngestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Ingest");

  const steps = [
    { title: t("st1"), desc: t("st1d") },
    { title: t("st2"), desc: t("st2d") },
    { title: t("st3"), desc: t("st3d") },
    { title: t("st4"), desc: t("st4d") },
    { title: t("st5"), desc: t("st5d") },
  ];

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.7, marginBlock: "6px 22px" }}>{t("subtitle")}</p>

      <div className="col-2">
        <IngestPanel />

        <aside style={{ background: "linear-gradient(160deg,#102A43,#0B1F33)", color: "#fff", borderRadius: 18, padding: 22, alignSelf: "start" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "rgba(20,184,166,.16)", border: "1px solid rgba(20,184,166,.3)", marginBlockEnd: 16 }}>
            <IconTile tint="transparent" size={16} radius={0}><span style={{ color: "var(--teal-light)", fontSize: 12 }}>✦</span></IconTile>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-light)" }}>{t("behindScenes")}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBlockEnd: 16 }}>{t("whatHappens")}</div>
          <NumberedStepper steps={steps} />
        </aside>
      </div>
    </main>
  );
}
