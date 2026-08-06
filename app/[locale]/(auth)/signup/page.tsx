import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AuthSplit } from "@/components/auth/AuthSplit";
import { SignUpForm } from "./SignUpForm";

function Feature({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, flex: "none", borderRadius: 9, background: "rgba(15, 118, 110,.16)", color: "var(--teal-light)" }}>{icon}</span>
      <span style={{ fontSize: 14, color: "#CBD5E1" }}>{children}</span>
    </div>
  );
}

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  const supabase = await getSupabaseServer();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect(`/${locale === "en" ? "en" : "ar"}/dashboard`);
  }

  return (
    <AuthSplit
      panel={
        <>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 999, background: "rgba(15, 118, 110,.14)", border: "1px solid rgba(15, 118, 110,.3)", color: "var(--teal-light)", fontSize: 12.5, fontWeight: 700, fontFamily: "var(--font-latin)" }}>
            Personal Brand Growth OS ✦
          </span>
          <h2 style={{ fontSize: "clamp(26px,3vw,34px)", fontWeight: 700, lineHeight: 1.5, marginBlock: "22px 14px" }}>
            {t("panelSignupTitle")} <span style={{ color: "var(--gold)" }}>{t("panelSignupHighlight")}</span>
          </h2>
          <p style={{ color: "#9FB3C8", lineHeight: 1.9, fontSize: 14.5, marginBlockEnd: 26 }}>{t("panelSignupBody")}</p>

          <div style={{ display: "grid", gap: 14 }}>
            <Feature icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0-11 4 4m-4-4-4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}>{t("panelFeat1")}</Feature>
            <Feature icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v14H4zM8 12l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}>{t("panelFeat2")}</Feature>
            <Feature icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13 2 4 14h7l-1 8 9-12h-7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>}>{t("panelFeat3")}</Feature>
          </div>

          <div style={{ marginBlockStart: 30, padding: 18, borderRadius: 14, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
            <p style={{ fontSize: 14, color: "#E2E8F0", lineHeight: 1.9 }}>{t("testimonialQuote")}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockStart: 14 }}>
              <span style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--teal)", color: "#04211d", fontWeight: 800 }}>
                {t("testimonialInitial")}
              </span>
              <span>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{t("testimonialName")}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "#8095AC" }}>{t("testimonialRole")}</span>
              </span>
            </div>
          </div>
        </>
      }
    >
      <SignUpForm />
    </AuthSplit>
  );
}
