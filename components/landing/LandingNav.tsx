"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS = [
  { href: "#features", key: "navFeatures" },
  { href: "#how", key: "navHow" },
  { href: "#pricing", key: "navPricing" },
  { href: "#faq", key: "navFaq" },
];

export function LandingNav() {
  const t = useTranslations("Landing");
  const [open, setOpen] = useState(false);

  return (
    <nav className="lp-nav">
      <div className="lp-wrap lp-nav-inner">
        <Link href="/" className="lp-brand">
          <span className="lp-brand-mark">✦</span>
          <span>أثر</span>
        </Link>
        <div className="lp-nav-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>{t(l.key)}</a>
          ))}
        </div>
        <div className="lp-nav-cta">
          <ThemeToggle compact />
          <Link href="/login" className="lp-nav-login" style={{ marginInlineEnd: 4 }}>{t("login")}</Link>
          <Link href="/signup" className="lp-btn lp-btn-primary">{t("cta")}</Link>
          <button className="lp-burger" aria-label="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="lp-wrap" style={{ paddingBlock: "10px 18px", display: "grid", gap: 4 }}>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ padding: "11px 12px", borderRadius: 10, fontSize: 15, fontWeight: 600, color: "var(--heading)", textDecoration: "none" }}>
              {t(l.key)}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
