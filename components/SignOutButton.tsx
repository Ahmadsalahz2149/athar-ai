"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { signOut } from "@/lib/auth/actions";

export function SignOutButton() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() => start(() => signOut(locale))}
      disabled={pending}
      style={{
        border: "1px solid var(--border-2)",
        background: "var(--card)",
        borderRadius: 999,
        padding: "6px 14px",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--slate)",
        cursor: "pointer",
      }}
    >
      {t("signOut")}
    </button>
  );
}
