import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AuthSplit } from "@/components/auth/AuthSplit";
import { AuthForm } from "./AuthForm";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  // Spec acceptance: authenticated users skip straight to the Dashboard.
  const supabase = await getSupabaseServer();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(`/${locale === "en" ? "en" : "ar"}/dashboard`);
  }

  return (
    <AuthSplit
      panel={
        <>
          <h2 style={{ fontSize: "clamp(26px,3vw,34px)", fontWeight: 700, lineHeight: 1.6 }}>
            {t("panelLoginTitle1")}
            <br />
            {t("panelLoginTitle2")}
          </h2>
          <p style={{ color: "#9FB3C8", lineHeight: 1.9, fontSize: 14.5, marginBlock: "14px 26px" }}>{t("panelLoginBody")}</p>
          <div style={{ padding: 20, borderRadius: 16, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 12 }}>
              <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 9, background: "rgba(214,168,79,.18)", color: "var(--gold)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c.7.7 1 1.3 1 2h6c0-.7.3-1.3 1-2a6 6 0 0 0-4-10z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span style={{ fontSize: 12.5, color: "#9FB3C8", fontWeight: 600 }}>{t("panelLoginCardEyebrow")}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.6 }}>{t("panelLoginCardTitle")}</div>
            <div style={{ fontSize: 13, color: "#8095AC", marginBlockStart: 6 }}>{t("panelLoginCardBody")}</div>
          </div>
        </>
      }
    >
      <AuthForm />
    </AuthSplit>
  );
}
