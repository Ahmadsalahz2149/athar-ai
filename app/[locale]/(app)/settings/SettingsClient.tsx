"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Props = { email: string; balance: number; completeness: number };
const TABS = ["profile", "brand", "team", "plan", "notifications"] as const;
const NOTIF_KEYS = ["analysis", "schedule", "weekly", "marketing"] as const;

export function SettingsClient({ email, balance, completeness }: Props) {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const [tab, setTab] = useState<(typeof TABS)[number]>("profile");
  const [notif, setNotif] = useState<Record<string, boolean>>(() => {
    const base = { analysis: true, schedule: true, weekly: true, marketing: false };
    if (typeof window === "undefined") return base;
    try {
      const raw = localStorage.getItem("athar-notif");
      return raw ? { ...base, ...JSON.parse(raw) } : base;
    } catch {
      return base;
    }
  });
  const toggle = (k: string) => {
    setNotif((n) => {
      const next = { ...n, [k]: !n[k] };
      try {
        localStorage.setItem("athar-notif", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 20, alignItems: "start" }} className="settings-grid">
      <nav style={{ display: "flex", flexDirection: "column", gap: 4, position: "sticky", insetBlockStart: 12 }}>
        {TABS.map((tb) => (
          <button key={tb} onClick={() => setTab(tb)} style={{ textAlign: "start", padding: "10px 14px", borderRadius: 11, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: tab === tb ? "var(--teal-tint-2)" : "transparent", color: tab === tb ? "var(--navy)" : "var(--slate)" }}>
            {t(`tab_${tb}`)}
          </button>
        ))}
      </nav>

      <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 22 }}>
        {tab === "profile" && (
          <Panel title={t("tab_profile")}>
            <Row label={t("email")}>{email || "—"}</Row>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBlockStart: 10 }}>{t("profileHint")}</p>
          </Panel>
        )}
        {tab === "brand" && (
          <Panel title={t("tab_brand")}>
            <Row label={t("dnaCompleteness")}>{nf.format(completeness)}%</Row>
            <div style={{ display: "flex", gap: 10, marginBlockStart: 14, flexWrap: "wrap" }}>
              <Link href="/dna" style={link}>{t("openDna")}</Link>
              <Link href="/ingest" style={linkGhost}>{t("addSamples")}</Link>
            </div>
          </Panel>
        )}
        {tab === "team" && (
          <Panel title={t("tab_team")}>
            <Row label={t("owner")}>{email || "—"}</Row>
            <div style={{ marginBlockStart: 16, padding: 16, borderRadius: 14, background: "var(--gold-tint)", border: "1px solid rgba(214,168,79,.3)" }}>
              <div style={{ fontWeight: 700, color: "var(--gold-dark)", marginBlockEnd: 4 }}>{t("teamUpsellTitle")}</div>
              <div style={{ fontSize: 13.5, color: "var(--slate)" }}>{t("teamUpsellBody")}</div>
            </div>
          </Panel>
        )}
        {tab === "plan" && (
          <Panel title={t("tab_plan")}>
            <Row label={t("currentPlan")}>{t("planFree")}</Row>
            <Row label={t("credits")}>{nf.format(balance)}</Row>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBlockStart: 16 }}>
              <PlanCard name={t("planPro")} price={t("pricePro")} feats={t("featPro")} />
              <PlanCard name={t("planAgency")} price={t("priceAgency")} feats={t("featAgency")} />
            </div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginBlockStart: 12 }}>{t("billingNote")}</p>
          </Panel>
        )}
        {tab === "notifications" && (
          <Panel title={t("tab_notifications")}>
            {NOTIF_KEYS.map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 14, color: "var(--slate)" }}>{t(`notif_${k}`)}</span>
                <button onClick={() => toggle(k)} aria-label={k} style={{ width: 44, height: 26, borderRadius: 999, border: "none", cursor: "pointer", background: notif[k] ? "var(--teal)" : "var(--border-2)", position: "relative", transition: "background .15s" }}>
                  <span style={{ position: "absolute", insetBlockStart: 3, insetInlineStart: notif[k] ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "inset-inline-start .15s" }} />
                </button>
              </div>
            ))}
          </Panel>
        )}
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 16 }}>{title}</h2>
      {children}
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 14, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--heading)" }}>{children}</span>
    </div>
  );
}
function PlanCard({ name, price, feats }: { name: string; price: string; feats: string }) {
  return (
    <div style={{ border: "1px solid var(--border-2)", borderRadius: 14, padding: 16 }}>
      <div style={{ fontWeight: 700, color: "var(--heading)" }}>{name}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--teal-deep)", fontFamily: "var(--font-latin)", marginBlock: "6px 8px" }}>{price}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>{feats}</div>
    </div>
  );
}
const link: React.CSSProperties = { display: "inline-flex", height: 40, alignItems: "center", padding: "0 18px", borderRadius: 11, background: "var(--teal)", color: "#fff", fontWeight: 700, fontSize: 13.5 };
const linkGhost: React.CSSProperties = { display: "inline-flex", height: 40, alignItems: "center", padding: "0 18px", borderRadius: 11, background: "var(--card)", border: "1px solid var(--border-2)", color: "var(--navy)", fontWeight: 700, fontSize: 13.5 };
