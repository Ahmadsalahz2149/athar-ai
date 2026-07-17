import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthSplit } from "@/components/auth/AuthSplit";
import { ForgotForm } from "./ForgotForm";

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <AuthSplit
      panel={
        <>
          <h2 style={{ fontSize: "clamp(26px,3vw,34px)", fontWeight: 700, lineHeight: 1.6 }}>
            {t("panelForgotTitle1")}
            <br />
            {t("panelForgotTitle2")}
          </h2>
          <p style={{ color: "#9FB3C8", lineHeight: 1.9, fontSize: 14.5, marginBlock: "14px 26px" }}>{t("panelForgotBody")}</p>
          <div style={{ padding: 20, borderRadius: 16, background: "rgba(20,184,166,.1)", border: "1px solid rgba(20,184,166,.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 12 }}>
              <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 9, background: "rgba(20,184,166,.2)", color: "var(--teal-light)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
              </span>
              <span style={{ fontSize: 12.5, color: "var(--teal-light)", fontWeight: 700 }}>{t("panelForgotCardEyebrow")}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.6 }}>{t("panelForgotCardTitle")}</div>
            <div style={{ fontSize: 13, color: "#8095AC", marginBlockStart: 6 }}>{t("panelForgotCardBody")}</div>
          </div>
        </>
      }
    >
      <ForgotForm />
    </AuthSplit>
  );
}
