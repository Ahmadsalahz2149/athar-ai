import { getTranslations } from "next-intl/server";

/** Full-screen soft-block shown when an account is suspended by an admin. The
 * account and its data are untouched — access is simply gated until reactivated. */
export async function SuspendedNotice({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Suspended" });
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--bg,#f9fafb)" }}>
      <div style={{ maxWidth: 440, textAlign: "center", background: "var(--card,#fff)", border: "1px solid var(--border)", borderRadius: 20, padding: "36px 28px", boxShadow: "0 12px 40px rgba(11,31,51,.1)" }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, margin: "0 auto 18px", display: "grid", placeItems: "center", background: "var(--coral-tint,#fde8e8)", color: "var(--coral,#dc2626)" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--heading)" }}>{t("title")}</h1>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.8, marginBlockStart: 10 }}>{t("body")}</p>
        <a href="mailto:support@athar.ai" style={{ display: "inline-block", marginBlockStart: 20, height: 42, lineHeight: "42px", padding: "0 22px", borderRadius: 11, background: "var(--teal)", color: "#fff", fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}>{t("contact")}</a>
      </div>
    </div>
  );
}
