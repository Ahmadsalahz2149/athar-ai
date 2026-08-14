import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthSplit } from "@/components/auth/AuthSplit";
import { ResetForm } from "./ResetForm";

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <AuthSplit
      panel={
        <>
          <h2 style={{ fontSize: "clamp(26px,3vw,34px)", fontWeight: 700, lineHeight: 1.6 }}>
            {t("panelResetTitle1")}
            <br />
            {t("panelResetTitle2")}
          </h2>
          <p style={{ color: "rgba(255,255,255,.70)", lineHeight: 1.9, fontSize: 14.5, marginBlockStart: 14 }}>{t("panelResetBody")}</p>
        </>
      }
    >
      <ResetForm />
    </AuthSplit>
  );
}
