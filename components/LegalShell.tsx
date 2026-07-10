import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TopBar } from "@/components/TopBar";

type TitleKey = "termsTitle" | "privacyTitle" | "refundTitle";

export async function LegalShell({ locale, titleKey }: { locale: string; titleKey: TitleKey }) {
  setRequestLocale(locale);
  const t = await getTranslations("Legal");

  return (
    <>
      <TopBar />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "clamp(32px,6vw,64px) clamp(20px,6vw,32px)" }}>
        <h1 style={{ fontSize: "clamp(24px,4vw,30px)", fontWeight: 700, color: "var(--heading)", marginBlockEnd: 14 }}>
          {t(titleKey)}
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--gold-dark)",
            background: "var(--gold-tint)",
            border: "1px solid rgba(214,168,79,.3)",
            borderRadius: 10,
            padding: "10px 14px",
            lineHeight: 1.7,
            marginBlockEnd: 20,
          }}
        >
          {t("draftNotice")}
        </p>
        <p style={{ fontSize: 15, color: "var(--slate)", lineHeight: 1.9, marginBlockEnd: 16 }}>{t("noTrain")}</p>
        <Link href="/" style={{ color: "var(--teal-deep)", fontWeight: 600, fontSize: 14 }}>
          ← {t("backHome")}
        </Link>
      </main>
    </>
  );
}
