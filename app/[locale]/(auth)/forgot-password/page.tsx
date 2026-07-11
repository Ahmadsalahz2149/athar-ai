import { setRequestLocale } from "next-intl/server";
import { ForgotForm } from "./ForgotForm";

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: 28, animation: "floatUp .4s ease" }}>
        <ForgotForm />
      </div>
    </div>
  );
}
