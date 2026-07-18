import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";

/** Friendly 404 inside the app shell (INFRA phase 5). */
export default async function NotFound() {
  const locale = await getLocale();
  const ar = locale === "ar";
  let title = ar ? "الصفحة غير موجودة" : "Page not found";
  let body = ar ? "الرابط الذي طلبته غير متاح أو تم نقله." : "The page you're looking for doesn't exist or was moved.";
  let cta = ar ? "العودة للوحة" : "Back to dashboard";
  try {
    const t = await getTranslations("NotFound");
    title = t("title"); body = t("body"); cta = t("cta");
  } catch { /* fall back to inline strings */ }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "clamp(48px,10vw,110px) 24px", textAlign: "center" }}>
      <div style={{ fontSize: 56, fontWeight: 800, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>404</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--heading)", marginBlockStart: 8 }}>{title}</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.8, marginBlock: "10px 22px", fontSize: 14.5 }}>{body}</p>
      <Link href="/dashboard" style={{ height: 46, padding: "0 22px", borderRadius: 12, display: "inline-grid", placeItems: "center", background: "linear-gradient(135deg,#102A43,#0B1F33)", color: "#fff", fontWeight: 700, fontSize: 14.5, textDecoration: "none" }}>{cta}</Link>
    </main>
  );
}
