import type { ReactNode } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { currentAdmin } from "@/lib/auth/admin";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await currentAdmin();
  if (!me) redirect(`/${locale === "en" ? "en" : "ar"}/dashboard`);
  const t = await getTranslations("Admin");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg,#f9fafb)" }}>
      {/* Dark admin chrome — visually distinct from the app so "admin mode" is obvious. */}
      <header style={{ background: "linear-gradient(160deg,#1f2937,#111827)", color: "#fff", padding: "0 clamp(16px,4vw,28px)", position: "sticky", top: 0, zIndex: 40, boxShadow: "0 2px 12px rgba(0,0,0,.18)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", background: "linear-gradient(160deg,var(--teal),var(--teal-deep,#0f766e))", fontSize: 16 }}>✦</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1 }}>{t("title")}</div>
              <div style={{ fontSize: 10.5, color: "#9CA3AF", marginBlockStart: 3 }}>{t("subtitle")}</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "#9CA3AF", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.email}</span>
          <Link href="/dashboard" style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", textDecoration: "none", padding: "7px 12px", borderRadius: 9, background: "rgba(255,255,255,.1)" }}>{t("backToApp")} ←</Link>
        </div>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <AdminNav />
        </div>
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(20px,3vw,32px) clamp(16px,4vw,28px) 80px" }}>{children}</main>
    </div>
  );
}
