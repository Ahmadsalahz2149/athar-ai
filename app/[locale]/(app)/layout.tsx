import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { AppTopBar } from "@/components/AppTopBar";
import { NavProvider } from "@/components/nav-context";
import { FloatingAssistant } from "@/components/assistant/FloatingAssistant";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ensureUserContext } from "@/lib/auth/bootstrap";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { SuspendedNotice } from "@/components/SuspendedNotice";

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
  let userEmail: string | undefined;
  let counts = { sources: 0, ideas: 0, drafts: 0, pending: 0, scheduled: 0 };
  let isAdmin = false;
  let suspended = false;
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${locale === "en" ? "en" : "ar"}/login`);
    userEmail = user.email ?? undefined;
    const ctx = await ensureUserContext(user.id, user.email ?? undefined);
    if (ctx && db) {
      try {
        const org = forOrg(db, ctx.orgId);
        [balance, counts, isAdmin, suspended] = await Promise.all([
          org.balance(),
          org.counts(ctx.brandId),
          isCurrentUserAdmin(),
          org.isSuspended(),
        ]);
      } catch {
        /* shell chrome is display-only — never block the app */
      }
    }
  }

  // Suspended accounts are soft-blocked: admins are exempt so they can still
  // reach the panel to lift the suspension.
  if (suspended && !isAdmin) {
    return <SuspendedNotice locale={locale} />;
  }

  return (
    <div className="app-shell">
      <NavProvider>
        <Sidebar balance={balance} sourcesUsed={counts.sources} pendingCount={counts.pending} isAdmin={isAdmin} />
        <div className="app-main">
          <AppTopBar userEmail={userEmail} />
          <div className="app-content scb">{children}</div>
        </div>
        <FloatingAssistant />
      </NavProvider>
    </div>
  );
}
