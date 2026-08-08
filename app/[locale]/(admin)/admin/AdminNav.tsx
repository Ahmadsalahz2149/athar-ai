"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const TABS = [
  { href: "/admin", key: "navDashboard", exact: true },
  { href: "/admin/accounts", key: "navAccounts", exact: false },
  { href: "/admin/coupons", key: "navCoupons", exact: false },
];

export function AdminNav() {
  const t = useTranslations("Admin");
  const pathname = usePathname();
  return (
    <nav style={{ display: "flex", gap: 4, overflowX: "auto" }} className="scb">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "12px 14px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", textDecoration: "none",
              color: active ? "#fff" : "#9CA3AF", borderBlockEnd: active ? "2px solid var(--teal)" : "2px solid transparent",
            }}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
