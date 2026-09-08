"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { findWorld, isActive } from "@/lib/nav-worlds";

/**
 * Secondary navigation: when the current route belongs to a world, show that
 * world's screens as a horizontal tab strip under the top bar. Gives one-click
 * switching within a world (idea → write → media, etc.). Renders nothing on the
 * dashboard/account screens (which belong to no world).
 */
export function WorldTabs({ navCounts = {} }: { navCounts?: Record<string, number> }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const pathname = usePathname();
  const world = findWorld(pathname);
  if (!world) return null;

  return (
    <div className="world-tabs scb" role="tablist" aria-label={t(world.labelKey)}>
      {world.items.map((item) => {
        const active = isActive(pathname, item.href);
        const count = navCounts[item.key] ?? 0;
        return (
          <Link key={item.href} href={item.href} role="tab" aria-selected={active} className="world-tab" data-active={active || undefined}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <path d={item.icon} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{t(item.key)}</span>
            {count > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "var(--font-latin)", minWidth: 16, height: 16, padding: "0 5px", borderRadius: 999, display: "grid", placeItems: "center", background: "var(--teal)", color: "#fff" }}>{nf.format(count)}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
