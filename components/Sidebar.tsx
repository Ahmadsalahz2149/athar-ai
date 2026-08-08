"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo } from "./Logo";
import { useNav } from "./nav-context";
import { CountBadge, ProgressMeter, btnGold } from "./ui/display";

function Icon({ d }: { d: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Exact order + labels from the prototype. NOTE: رفع محتوى has no sidebar entry
// by design — it is reached from the Vault CTA / quick actions.
const NAV: { href: string; key: string; icon: ReactNode }[] = [
  { href: "/dashboard", key: "home", icon: <Icon d="M3 11l9-8 9 8M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" /> },
  { href: "/vault", key: "vault", icon: <Icon d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /> },
  { href: "/dna", key: "dna", icon: <Icon d="M7 4c6 3 4 8 10 11M17 4c-6 3-4 8-10 11M8 6h8M8 18h8" /> },
  { href: "/brand", key: "brand", icon: <Icon d="M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7l7-4zM9.5 12l1.8 1.8L15 10" /> },
  { href: "/ideas", key: "ideas", icon: <Icon d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c.7.7 1 1.3 1 2h6c0-.7.3-1.3 1-2a6 6 0 0 0-4-10z" /> },
  { href: "/plan", key: "plan", icon: <Icon d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9h16M8 13h4M8 16h8" /> },
  { href: "/studio", key: "studio", icon: <Icon d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /> },
  { href: "/media", key: "media", icon: <Icon d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM10 9l5 3-5 3z" /> },
  { href: "/distribute", key: "distribute", icon: <Icon d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 3.9M15.4 6.6l-6.8 3.9" /> },
  { href: "/calendar", key: "calendar", icon: <Icon d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9h16M8 3v4M16 3v4" /> },
  { href: "/approvals", key: "approvals", icon: <Icon d="M9 12l2 2 4-4M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7z" /> },
  { href: "/analytics", key: "analytics", icon: <Icon d="M4 19V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM8 15l3-4 3 3 3-5" /> },
  { href: "/mylink", key: "mylink", icon: <Icon d="M9 15l6-6M10 6l1-1a3.5 3.5 0 0 1 5 5l-1 1M14 18l-1 1a3.5 3.5 0 0 1-5-5l1-1" /> },
  { href: "/activity", key: "activity", icon: <Icon d="M3 12h4l2 6 4-14 2 8h6" /> },
  { href: "/readiness", key: "readiness", icon: <Icon d="M9 11l3 3L20 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /> },
  { href: "/billing", key: "billing", icon: <Icon d="M3 10h18M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 15h4" /> },
  { href: "/help", key: "help", icon: <Icon d="M9.1 9a3 3 0 1 1 4.5 2.6c-.9.5-1.6 1.3-1.6 2.4M12 17h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" /> },
  { href: "/settings", key: "settings", icon: <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4.3 15a1.7 1.7 0 0 0-.3 1.9l.1.1a2 2 0 1 0 2.8 2.8l.1-.1a1.7 1.7 0 0 1 2.9 1.2V21a2 2 0 1 0 4 0v-.1a1.7 1.7 0 0 1 2.9-1.2l.1.1a2 2 0 1 0 2.8-2.8l-.1-.1a1.7 1.7 0 0 1 1.2-2.9H21a2 2 0 1 0 0-4h-.1a1.7 1.7 0 0 1-1.2-2.9l.1-.1a2 2 0 1 0-2.8-2.8l-.1.1a1.7 1.7 0 0 1-2.9-1.2V3a2 2 0 1 0-4 0v.1A1.7 1.7 0 0 1 7.1 4.3L7 4.2a2 2 0 1 0-2.8 2.8l.1.1A1.7 1.7 0 0 1 3.2 10H3a2 2 0 1 0 0 4h.1a1.7 1.7 0 0 1 1.2 1z" /> },
];

export function Sidebar({
  balance = null,
  sourcesUsed = 0,
  sourcesLimit = 5,
  pendingCount = 0,
  isAdmin = false,
}: {
  balance?: number | null;
  sourcesUsed?: number;
  sourcesLimit?: number;
  pendingCount?: number;
  isAdmin?: boolean;
}) {
  const t = useTranslations("Nav");
  const admin = useTranslations("Admin");
  const brand = useTranslations("Brand");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const pathname = usePathname();
  const { open, setOpen } = useNav();
  const close = () => setOpen(false);
  const usagePct = Math.max(0, Math.min(100, (sourcesUsed / Math.max(1, sourcesLimit)) * 100));

  return (
    <>
      {open && <div className="nav-overlay" onClick={close} aria-hidden />}
      <aside
        className={`app-sidebar${open ? " open" : ""}`}
        style={{
          background: "linear-gradient(180deg,#273343,#1F2937)",
          color: "#fff",
          borderInlineStart: "1px solid rgba(255,255,255,.06)",
        }}
      >
        <Link href="/dashboard" className="app-brand" onClick={close}>
          <Logo size={34} />
          <div className="app-brand-text">
            <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
              {brand("name")}
              <span style={{ color: "var(--teal-light)" }}> {brand("ai")}</span>
            </div>
            <div style={{ fontSize: 10.5, color: "#8095AC", fontFamily: "var(--font-latin)", letterSpacing: ".2px" }}>
              Growth OS
            </div>
          </div>
        </Link>

        <nav className="app-nav">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "11px 12px",
                  borderRadius: 11,
                  background: active ? "rgba(15, 118, 110,.15)" : "transparent",
                  color: active ? "#fff" : "#9FB3C8",
                  fontWeight: active ? 600 : 500,
                  fontSize: 14,
                }}
              >
                {active && (
                  <span
                    style={{
                      position: "absolute",
                      insetInlineEnd: 0,
                      insetBlock: 8,
                      width: 3,
                      borderRadius: 3,
                      background: "var(--teal-light)",
                    }}
                  />
                )}
                <span style={{ display: "grid", placeItems: "center", color: active ? "var(--teal-light)" : "#8095AC" }}>
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{t(item.key)}</span>
                {item.key === "approvals" && pendingCount > 0 && <CountBadge n={nf.format(pendingCount)} />}
              </Link>
            );
          })}
        </nav>

        {isAdmin && (
          <Link
            href="/admin"
            onClick={close}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 12, marginBlockEnd: 10, textDecoration: "none", background: "linear-gradient(135deg,var(--teal),var(--teal-deep,#0f766e))", color: "#fff", fontWeight: 700, fontSize: 13 }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7z" /><path d="M9 12l2 2 4-4" /></svg>
            <span style={{ flex: 1 }}>{admin("adminLink")}</span>
          </Link>
        )}

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
          <div style={{ fontSize: 11.5, color: "#9FB3C8", marginBlockEnd: 8 }}>
            {t("planUsageReal", { used: nf.format(sourcesUsed), limit: nf.format(sourcesLimit) })}
          </div>
          <ProgressMeter pct={usagePct} height={6} track="rgba(255,255,255,.12)" color="var(--teal)" />
          {balance != null && (
            <div style={{ fontSize: 11, color: "#8095AC", marginBlockStart: 8 }}>{t("creditsLeft", { n: nf.format(balance) })}</div>
          )}
          <Link href="/settings" onClick={close} style={{ ...btnGold, width: "100%", height: 36, marginBlockStart: 10, fontSize: 12.5 }}>
            {t("upgrade")}
          </Link>
        </div>
      </aside>
    </>
  );
}
