"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export type AccountRow = { id: string; name: string; ownerEmail?: string; balance: number; brands: number; members: number; suspended: boolean };

export function AccountsClient({ orgs, locale }: { orgs: AccountRow[]; locale: string }) {
  const t = useTranslations("Admin");
  const nf = useMemo(() => new Intl.NumberFormat(locale === "ar" ? "ar" : "en"), [locale]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orgs.filter((o) => {
      if (filter === "active" && o.suspended) return false;
      if (filter === "suspended" && !o.suspended) return false;
      if (!needle) return true;
      return o.name.toLowerCase().includes(needle) || (o.ownerEmail || "").toLowerCase().includes(needle) || o.id.includes(needle);
    });
  }, [orgs, q, filter]);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBlockEnd: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchAccounts")}
          style={{ flex: 1, minWidth: 220, height: 42, padding: "0 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 14, color: "var(--heading)", outline: "none", fontFamily: "inherit" }}
        />
        <div style={{ display: "flex", gap: 4, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 4 }}>
          {(["all", "active", "suspended"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ height: 34, padding: "0 14px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, background: filter === f ? "var(--teal)" : "transparent", color: filter === f ? "#fff" : "var(--muted)" }}>
              {t(`filter_${f}`)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBlockEnd: 10 }}>{t("resultCount", { n: nf.format(shown.length) })}</div>

      <div style={{ display: "grid", gap: 8 }}>
        {shown.map((o) => (
          <Link key={o.id} href={`/admin/accounts/${o.id}`} className="lift" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", textDecoration: "none" }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", background: o.suspended ? "var(--coral-tint,#fde8e8)" : "var(--teal-tint)", color: o.suspended ? "var(--coral,#dc2626)" : "var(--teal-deep)", fontWeight: 700 }}>{o.name.slice(0, 1).toUpperCase()}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.ownerEmail || t("noEmail")}</div>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("brandsN", { n: nf.format(o.brands) })}</span>
              {o.suspended && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--coral,#dc2626)", background: "var(--coral-tint,#fde8e8)", padding: "3px 9px", borderRadius: 999 }}>{t("suspended")}</span>}
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--teal-deep)", fontFamily: "var(--font-latin)", minWidth: 44, textAlign: "end" }}>{nf.format(o.balance)}</span>
            </div>
          </Link>
        ))}
        {shown.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13.5, padding: 30 }}>{t("noResults")}</div>}
      </div>
    </div>
  );
}
