"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { SignOutButton } from "./SignOutButton";

export function AppTopBar() {
  const nav = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "ar" ? "en" : "ar";

  return (
    <header
      style={{
        height: 64,
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(16px,4vw,32px)",
        borderBottom: "1px solid var(--border)",
        background: "rgba(255,255,255,.6)",
        backdropFilter: "blur(8px)",
      }}
    >
      <Link
        href="/studio"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          height: 40,
          padding: "0 16px",
          borderRadius: 11,
          background: "linear-gradient(135deg,#102A43,#0B1F33)",
          color: "#fff",
          fontSize: 13.5,
          fontWeight: 700,
          boxShadow: "0 10px 22px -12px rgba(11,31,51,.7)",
        }}
      >
        ✦ {nav("createPost")}
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link
          href={pathname}
          locale={other}
          style={{
            color: "var(--navy)",
            border: "1px solid var(--border-2)",
            borderRadius: 999,
            padding: "6px 14px",
            background: "var(--card)",
            fontSize: 13.5,
            fontWeight: 600,
            fontFamily: other === "en" ? "var(--font-latin)" : "var(--font-ar)",
          }}
        >
          {nav("switchTo")}
        </Link>
        <SignOutButton />
      </div>
    </header>
  );
}
