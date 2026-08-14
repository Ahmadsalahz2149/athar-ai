import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TopBar } from "@/components/TopBar";
import type { LegalDoc } from "@/app/[locale]/(legal)/legal-content";

type TitleKey = "termsTitle" | "privacyTitle" | "refundTitle";

export async function LegalShell({ locale, titleKey, doc }: { locale: string; titleKey: TitleKey; doc: LegalDoc }) {
  setRequestLocale(locale);
  const t = await getTranslations("Legal");

  return (
    <>
      <TopBar />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "clamp(32px,6vw,64px) clamp(20px,6vw,32px)" }}>
        <h1 style={{ fontSize: "clamp(24px,4vw,30px)", fontWeight: 700, color: "var(--heading)", marginBlockEnd: 6 }}>
          {t(titleKey)}
        </h1>
        <div className="mono-label" style={{ color: "var(--muted)", marginBlockEnd: 20 }}>{t("updatedLabel", { date: doc.updated })}</div>

        <p style={{ fontSize: 15, color: "var(--slate)", lineHeight: 1.9, marginBlockEnd: 24 }}>{doc.intro}</p>

        {doc.sections.map((s) => (
          <section key={s.h} style={{ marginBlockEnd: 22 }}>
            <h2 style={{ fontSize: 16.5, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 8 }}>{s.h}</h2>
            {s.p.map((para, i) => (
              <p key={i} style={{ fontSize: 14.5, color: "var(--slate)", lineHeight: 1.9, marginBlockEnd: 8 }}>{para}</p>
            ))}
          </section>
        ))}

        <div style={{ borderTop: "1px solid var(--border)", paddingBlockStart: 18, marginBlockStart: 8 }}>
          <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.8, marginBlockEnd: 14 }}>{t("draftNotice")}</p>
          <Link href="/" style={{ color: "var(--teal-deep)", fontWeight: 600, fontSize: 14 }}>
            ← {t("backHome")}
          </Link>
        </div>
      </main>
    </>
  );
}
