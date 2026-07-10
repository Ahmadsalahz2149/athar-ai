import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { AppTopBar } from "@/components/AppTopBar";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ensureUserContext } from "@/lib/auth/bootstrap";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Gate the app behind auth when Supabase is configured.
  const supabase = await getSupabaseServer();
  let balance: number | null = null;
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${locale === "en" ? "en" : "ar"}/login`);
    const ctx = await ensureUserContext(user.id, user.email ?? undefined);
    if (ctx && db) {
      try {
        balance = await forOrg(db, ctx.orgId).balance();
      } catch {
        /* balance is display-only — never block the app */
      }
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar balance={balance} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AppTopBar />
        <div className="scb" style={{ flex: 1, overflowY: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
