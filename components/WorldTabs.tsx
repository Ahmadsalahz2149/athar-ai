"use client";

import { Fragment } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { findWorld, isActive } from "@/lib/nav-worlds";

/**
 * Secondary navigation under the top bar. For a normal world it's a tab strip;
 * for a `pipeline` world (Create) it's a numbered stepper that frames the
 * screens as stages of one flow (idea → write → media → …). Renders nothing on
 * dashboard/account screens (which belong to no world).
 */
export function WorldTabs({ navCounts = {} }: { navCounts?: Record<string, number> }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const pathname = usePathname();
  const world = findWorld(pathname);
  if (!world) return null;

  const activeIdx = world.items.findIndex((i) => isActive(pathname, i.href));

  if (world.pipeline) {
    return (
      <div className="world-stepper scb" role="tablist" aria-label={t(world.labelKey)}>
        {world.items.map((item, i) => {
          const active = i === activeIdx;
          const done = activeIdx > -1 && i < activeIdx;
          return (
            <Fragment key={item.href}>
              {i > 0 && <span className="step-connector" data-filled={activeIdx > -1 && i <= activeIdx ? "" : undefined} />}
              <Link href={item.href} role="tab" aria-selected={active} className="world-step" data-active={active ? "" : undefined} data-done={done ? "" : undefined}>
                <span className="step-num">
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  ) : (
                    nf.format(i + 1)
                  )}
                </span>
                <span className="step-label">{t(item.key)}</span>
              </Link>
            </Fragment>
          );
        })}
      </div>
    );
  }

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
