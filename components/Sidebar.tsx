"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo } from "./Logo";
import { useNav } from "./nav-context";
import { CountBadge, ProgressMeter } from "./ui/display";
import { WORLDS, DASHBOARD, ACCOUNT, ALL_LEAVES, isActive, type NavLeaf } from "@/lib/nav-worlds";

function Icon({ d }: { d: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

  const Leaf = ({ item, indent = false }: { item: NavLeaf; indent?: boolean }) => {
    const active = isActive(pathname, item.href);
    const count = navCounts[item.key] ?? 0;
    return (
      <Link
        href={item.href}
        onClick={close}
        title={collapsed ? t(item.key) : undefined}
        className="nav-item"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "8px 12px",
          paddingInlineStart: indent && !collapsed ? 30 : 12,
          borderRadius: 8,
          background: active ? "rgba(158,61,87,.20)" : "transparent",
          color: active ? "#f2f2f1" : "#a3a3a9",
          fontWeight: active ? 600 : 450,
          fontSize: 13.5,
          textDecoration: "none",
        }}
      >
        {active && (
          <span className="nav-active-bar" style={{ position: "absolute", insetInlineStart: 0, insetBlock: 7, width: 3, borderRadius: 3, background: "#c76a80" }} />
        )}
        <span style={{ display: "grid", placeItems: "center", flexShrink: 0, color: active ? "#e88aa1" : "#7d7d84" }}>
          <Icon d={item.icon} />
        </span>
        <span className="nav-label" style={{ flex: 1 }}>{t(item.key)}</span>
        {count > 0 && <CountBadge n={nf.format(count)} tone="teal" />}
      </Link>
    );
  };

  return (
    <>
      {open && <div className="nav-overlay" onClick={close} aria-hidden />}
      <aside
        className={`app-sidebar${open ? " open" : ""}${collapsed ? " collapsed" : ""}`}
        style={{ background: "#0f0f11", color: "#f2f2f1", borderInlineEnd: "1px solid rgba(255,255,255,.07)" }}
      >
        <div className="app-brand">
          <Link href="/dashboard" onClick={close} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, textDecoration: "none" }}>
            <Logo size={32} />
            <div className="app-brand-text">
              <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.2, color: "#f2f2f1" }}>
                {brand("name")}
                <span style={{ color: "#e88aa1" }}> {brand("ai")}</span>
              </div>
              <div className="mono-label" style={{ fontSize: 9.5, color: "#77777e", marginBlockStart: 2 }}>Growth OS</div>
            </div>
          </Link>
          <button className="nav-collapse-btn desktop-only" onClick={toggleCollapsed} aria-label={collapsed ? t("expand") : t("collapse")} title={collapsed ? t("expand") : t("collapse")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
            </svg>
          </button>
        </div>

        <nav className="app-nav">
          {collapsed ? (
            /* Collapsed rail: every screen as an icon (worlds flattened). */
            ALL_LEAVES.map((item) => <Leaf key={item.href} item={item} />)
          ) : (
            <>
              <Leaf item={DASHBOARD} />
              {WORLDS.map((w) => {
                const hasActive = w.items.some((i) => isActive(pathname, i.href));
                return (
                  <div key={w.key} style={{ display: "grid", gap: 2 }}>
                    {/* One click enters the world (its first screen) and expands it. */}
                    <Link
                      href={w.items[0].href}
                      onClick={close}
                      aria-expanded={hasActive}
                      className="nav-item"
                      style={{
                        display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "8px 12px", borderRadius: 8,
                        textDecoration: "none", textAlign: "start",
                        color: hasActive ? "#f2f2f1" : "#c9c9cf", fontWeight: 600, fontSize: 13.5,
                      }}
                    >
                      <span style={{ display: "grid", placeItems: "center", flexShrink: 0, color: hasActive ? "#e88aa1" : "#9a9aa1" }}><Icon d={w.icon} /></span>
                      <span style={{ flex: 1 }}>{t(w.labelKey)}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#77777e", flexShrink: 0, transform: hasActive ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </Link>
                    {hasActive && <div style={{ display: "grid", gap: 2 }}>{w.items.map((i) => <Leaf key={i.href} item={i} indent />)}</div>}
                  </div>
                );
              })}

              <div className="mono-label" style={{ color: "#66666c", padding: "12px 12px 2px" }}>{t("accountGroup")}</div>
              {ACCOUNT.map((i) => <Leaf key={i.href} item={i} />)}
            </>
          )}
        </nav>

        <div style={{ marginBlockStart: "auto", display: "grid", gap: 10, paddingBlockStart: 10 }}>
          {isAdmin && (
            <Link href="/admin" onClick={close} title={collapsed ? admin("adminLink") : undefined} className="nav-item" style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 8, textDecoration: "none", background: "rgba(158,61,87,.20)", color: "#e88aa1", fontWeight: 600, fontSize: 13 }}>
              <span style={{ display: "grid", placeItems: "center", flexShrink: 0 }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7z" /><path d="M9 12l2 2 4-4" /></svg></span>
              <span className="nav-label" style={{ flex: 1 }}>{admin("adminLink")}</span>
            </Link>
          )}

          <div className="app-plan-card nav-label" style={{ padding: 13, borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBlockEnd: 8, color: "#f2f2f1" }}>{t("planFree")}</div>
            <div style={{ fontSize: 11.5, color: "#a3a3a9", marginBlockEnd: 8 }}>{t("planUsageReal", { used: nf.format(sourcesUsed), limit: nf.format(sourcesLimit) })}</div>
            <ProgressMeter pct={usagePct} height={6} track="rgba(255,255,255,.12)" color="var(--teal)" />
            {balance != null && <div style={{ fontSize: 11, color: "#8b8b91", marginBlockStart: 8 }}>{t("creditsLeft", { n: nf.format(balance) })}</div>}
            <Link href="/settings" onClick={close} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 34, marginBlockStart: 10, fontSize: 12.5, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(255,255,255,.14)", background: "transparent", color: "#f2f2f1", textDecoration: "none" }}>{t("upgrade")}</Link>
          </div>

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
