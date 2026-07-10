import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/Sidebar";
import { AppTopBar } from "@/components/AppTopBar";

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AppTopBar />
        <div className="scb" style={{ flex: 1, overflowY: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
