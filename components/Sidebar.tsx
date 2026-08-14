"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo } from "./Logo";
import { useNav } from "./nav-context";
import { CountBadge, ProgressMeter } from "./ui/display";

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
  { href: "/scenes", key: "scenes", icon: <Icon d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9.5a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM5.5 18a6.5 6.5 0 0 1 13 0" /> },
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
  navCounts = {},
  isAdmin = false,
  userEmail,
}: {
  balance?: number | null;
  sourcesUsed?: number;
  sourcesLimit?: number;
  /** Badge counts keyed by nav key (e.g. { approvals: 3, ideas: 12 }). */
  navCounts?: Record<string, number>;
  isAdmin?: boolean;
  userEmail?: string;
}) {
  const t = useTranslations("Nav");
  const admin = useTranslations("Admin");
  const brand = useTranslations("Brand");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const pathname = usePathname();
  const { open, setOpen, collapsed, toggleCollapsed } = useNav();
  const close = () => setOpen(false);
  const usagePct = Math.max(0, Math.min(100, (sourcesUsed / Math.max(1, sourcesLimit)) * 100));
  const displayName = userEmail?.split("@")[0] ?? brand("name");
  const initial = (userEmail?.[0] ?? "A").toUpperCase();

  return (
    <>
      {open && <div className="nav-overlay" onClick={close} aria-hidden />}
      <aside
        className={`app-sidebar${open ? " open" : ""}${collapsed ? " collapsed" : ""}`}
        style={{
          background: "#0f0f11",
          color: "#f2f2f1",
          borderInlineEnd: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <div className="app-brand">
          <Link href="/dashboard" onClick={close} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, textDecoration: "none" }}>
            <Logo size={32} />
            <div className="app-brand-text">
              <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.2, color: "#f2f2f1" }}>
                {brand("name")}
                <span style={{ color: "#e88aa1" }}> {brand("ai")}</span>
              </div>
              <div className="mono-label" style={{ fontSize: 9.5, color: "#77777e", marginBlockStart: 2 }}>
                Growth OS
              </div>
            </div>
          </Link>
          <button
            className="nav-collapse-btn desktop-only"
            onClick={toggleCollapsed}
            aria-label={collapsed ? t("expand") : t("collapse")}
            title={collapsed ? t("expand") : t("collapse")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
            </svg>
          </button>
        </div>

        <nav className="app-nav">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                title={collapsed ? t(item.key) : undefined}
                className="nav-item"
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: active ? "rgba(158,61,87,.20)" : "transparent",
                  color: active ? "#f2f2f1" : "#a3a3a9",
                  fontWeight: active ? 600 : 450,
                  fontSize: 13.5,
                }}
              >
                {active && (
                  <span
                    className="nav-active-bar"
                    style={{
                      position: "absolute",
                      insetInlineStart: 0,
                      insetBlock: 7,
                      width: 3,
                      borderRadius: 3,
                      background: "#c76a80",
                    }}
                  />
                )}
                <span style={{ display: "grid", placeItems: "center", flexShrink: 0, color: active ? "#e88aa1" : "#7d7d84" }}>
                  {item.icon}
                </span>
                <span className="nav-label" style={{ flex: 1 }}>{t(item.key)}</span>
                {(navCounts[item.key] ?? 0) > 0 && <CountBadge n={nf.format(navCounts[item.key])} tone="teal" />}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginBlockStart: "auto", display: "grid", gap: 10, paddingBlockStart: 10 }}>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={close}
              title={collapsed ? admin("adminLink") : undefined}
              className="nav-item"
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 8, textDecoration: "none", background: "rgba(158,61,87,.20)", color: "#e88aa1", fontWeight: 600, fontSize: 13 }}
            >
              <span style={{ display: "grid", placeItems: "center", flexShrink: 0 }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7z" /><path d="M9 12l2 2 4-4" /></svg></span>
              <span className="nav-label" style={{ flex: 1 }}>{admin("adminLink")}</span>
            </Link>
          )}

          <div
            className="app-plan-card nav-label"
            style={{ padding: 13, borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBlockEnd: 8, color: "#f2f2f1" }}>{t("planFree")}</div>
            <div style={{ fontSize: 11.5, color: "#a3a3a9", marginBlockEnd: 8 }}>
              {t("planUsageReal", { used: nf.format(sourcesUsed), limit: nf.format(sourcesLimit) })}
            </div>
            <ProgressMeter pct={usagePct} height={6} track="rgba(255,255,255,.12)" color="var(--teal)" />
            {balance != null && (
              <div style={{ fontSize: 11, color: "#8b8b91", marginBlockStart: 8 }}>{t("creditsLeft", { n: nf.format(balance) })}</div>
            )}
            <Link href="/settings" onClick={close} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 34, marginBlockStart: 10, fontSize: 12.5, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(255,255,255,.14)", background: "transparent", color: "#f2f2f1", textDecoration: "none" }}>
              {t("upgrade")}
            </Link>
          </div>

          {/* User chip (grounds the sidebar, like the reference) */}
          <Link href="/settings" onClick={close} title={collapsed ? displayName : undefined} className="nav-user" style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 6px", borderRadius: 10, textDecoration: "none", borderBlockStart: "1px solid rgba(255,255,255,.07)", marginBlockStart: 2 }}>
            <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(255,255,255,.1)", color: "#f2f2f1", fontWeight: 700, fontSize: 12.5 }}>{initial}</span>
            <span className="nav-label" style={{ minWidth: 0, flex: 1, lineHeight: 1.25 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#f2f2f1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</span>
              <span className="mono-label" style={{ display: "block", fontSize: 9, color: "#77777e", marginBlockStart: 1 }}>Workspace</span>
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
}
