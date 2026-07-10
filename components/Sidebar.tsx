"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo } from "./Logo";
import { START_GRANT } from "@/lib/credits/costs";

function Icon({ d }: { d: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV: { href: string; key: string; icon: ReactNode }[] = [
  { href: "/studio", key: "studio", icon: <Icon d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /> },
  { href: "/ingest", key: "ingest", icon: <Icon d="M12 3v10m0-10l3.5 3.5M12 3 8.5 6.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /> },
  { href: "/analysis", key: "analysis", icon: <Icon d="M4 19V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM8 15l3-4 3 3 3-5" /> },
  { href: "/dna", key: "dna", icon: <Icon d="M7 4c6 3 4 8 10 11M17 4c-6 3-4 8-10 11M8 6h8M8 18h8" /> },
];

export function Sidebar({ balance = null }: { balance?: number | null }) {
  const t = useTranslations("Nav");
  const brand = useTranslations("Brand");
  const pathname = usePathname();
  const pct = balance == null ? 60 : Math.max(3, Math.min(100, Math.round((balance / START_GRANT) * 100)));

  return (
    <aside
      className="app-sidebar"
      style={{
        background: "linear-gradient(180deg,#102A43,#0B1F33)",
        color: "#fff",
        borderInlineStart: "1px solid rgba(255,255,255,.06)",
      }}
    >
      <Link href="/" className="app-brand">
        <Logo size={34} />
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          {brand("name")}
          <span style={{ color: "var(--teal-light)" }}> {brand("ai")}</span>
        </div>
      </Link>

      <nav className="app-nav">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "11px 12px",
                borderRadius: 11,
                background: active ? "rgba(20,184,166,.15)" : "transparent",
                color: active ? "#fff" : "#9FB3C8",
                fontWeight: active ? 600 : 500,
                fontSize: 14,
              }}
            >
              <span style={{ display: "grid", placeItems: "center", color: active ? "var(--teal-light)" : "#8095AC" }}>
                {item.icon}
              </span>
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div
        className="app-plan"
        style={{
          padding: 14,
          borderRadius: 14,
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.1)",
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBlockEnd: 8 }}>{t("planFree")}</div>
        <div style={{ height: 6, borderRadius: 6, background: "rgba(255,255,255,.12)", overflow: "hidden", marginBlockEnd: 8 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--teal)" }} />
        </div>
        <div style={{ fontSize: 11.5, color: "#9FB3C8" }}>
          {balance == null ? t("planUsage") : t("creditsLeft", { n: balance })}
        </div>
      </div>
    </aside>
  );
}
