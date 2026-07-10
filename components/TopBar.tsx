"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo, BrandWord } from "./Logo";

export function TopBar() {
  const nav = useTranslations("Nav");
  const brand = useTranslations("Brand");
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "ar" ? "en" : "ar";

  return (
    <header
      style={{
        height: 68,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(16px,5vw,48px)",
        borderBottom: "1px solid var(--border)",
        background: "rgba(255,255,255,.65)",
        backdropFilter: "blur(8px)",
        position: "sticky",
        insetBlockStart: 0,
        zIndex: 10,
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <Logo size={36} />
        <BrandWord name={brand("name")} ai={brand("ai")} tagline={brand("tagline")} />
      </Link>
      <nav style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 14, fontWeight: 600 }}>
        <Link href="/studio" style={{ color: "var(--slate)" }}>
          {nav("studio")}
        </Link>
        <Link
          href={pathname}
          locale={other}
          style={{
            color: "var(--navy)",
            border: "1px solid var(--border-2)",
            borderRadius: 999,
            padding: "6px 14px",
            background: "var(--card)",
            fontFamily: other === "en" ? "var(--font-latin)" : "var(--font-ar)",
          }}
        >
          {nav("switchTo")}
        </Link>
      </nav>
    </header>
  );
}
