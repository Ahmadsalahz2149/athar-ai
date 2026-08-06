"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { StatCard, btnTeal, btnGhost, btnGold } from "@/components/ui/display";
import { redeemCoupon } from "./actions";

const cardStyle: CSSProperties = { background: "var(--surface,#fff)", border: "1px solid var(--border)", borderRadius: 16, padding: "clamp(16px,2.4vw,22px)", marginBlockEnd: 16 };
const input: CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg,#fff)", fontSize: 14, color: "var(--heading)", fontFamily: "inherit" };

const PLANS = [
  { key: "free", price: 0, credits: "200" },
  { key: "pro", price: 99, credits: "3,000", highlight: true },
  { key: "agency", price: 299, credits: "12,000" },
];
const PACKS = [
  { credits: 500, price: 29 }, { credits: 1500, price: 69 }, { credits: 4000, price: 149 },
];

export function BillingClient({ balance, referral, locale }: { balance: number; referral: { code: string; count: number }; locale: string }) {
  const t = useTranslations("Billing");
  const router = useRouter();
  const nf = useMemo(() => new Intl.NumberFormat(locale === "ar" ? "ar" : "en"), [locale]);
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const referralUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/signup?ref=${referral.code}`;

  const redeem = () =>
    start(async () => {
      setMsg(null);
      const r = await redeemCoupon(code);
      if (r.ok) { setMsg({ ok: true, text: t("redeemOk", { n: nf.format(r.credits) }) }); setCode(""); router.refresh(); }
      else setMsg({ ok: false, text: t(`err_${r.error}`) || t("err_generic") });
    });

  const copyRef = () => navigator.clipboard?.writeText(referralUrl).catch(() => {});

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 12, marginBlockEnd: 16 }}>
        <StatCard label={t("balance")} value={nf.format(balance)} tint="var(--teal-tint,#e6f7f4)" />
        <StatCard label={t("referrals")} value={nf.format(referral.count)} tint="var(--gold-tint)" />
      </div>

      {/* Coupon — real */}
      <section style={cardStyle} className="lift">
        <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 4 }}>{t("couponTitle")}</div>
        <div style={{ fontSize: 12.8, color: "var(--muted)", marginBlockEnd: 12 }}>{t("couponDesc")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && !pending && redeem()} placeholder={t("couponPh")} dir="ltr" style={{ ...input, flex: 1, minWidth: 160, fontFamily: "var(--font-latin)", letterSpacing: "1px" }} />
          <button onClick={redeem} disabled={pending || !code.trim()} style={{ ...btnTeal, height: 42 }}>{pending ? t("redeeming") : t("redeem")}</button>
        </div>
        {msg && <div style={{ marginBlockStart: 10, fontSize: 13, fontWeight: 600, color: msg.ok ? "var(--teal)" : "var(--danger,#dc2626)" }}>{msg.text}</div>}
      </section>

      {/* Plans — gated */}
      <section style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBlockEnd: 4 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--heading)" }}>{t("plansTitle")}</div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "var(--gold-tint)", color: "var(--gold-dark)" }}>{t("soon")}</span>
        </div>
        <div style={{ fontSize: 12.8, color: "var(--muted)", marginBlockEnd: 14 }}>{t("plansDesc")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 12 }}>
          {PLANS.map((p) => (
            <div key={p.key} style={{ border: `1px solid ${p.highlight ? "var(--teal)" : "var(--border)"}`, borderRadius: 14, padding: 16, background: p.highlight ? "var(--teal-tint,#e6f7f4)" : "transparent" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--heading)" }}>{t(`plan_${p.key}`)}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--heading)", marginBlock: "6px 2px", fontFamily: "var(--font-latin)" }}>${p.price}<span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>/{t("mo")}</span></div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginBlockEnd: 12 }}>{t("creditsMo", { n: p.credits })}</div>
              <button disabled style={{ ...(p.highlight ? btnTeal : btnGhost), width: "100%", height: 38, opacity: 0.55, cursor: "not-allowed" }}>{p.price === 0 ? t("current") : t("upgrade")}</button>
            </div>
          ))}
        </div>
      </section>

      {/* Points top-up — gated, points to coupons */}
      <section style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBlockEnd: 4 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--heading)" }}>{t("packsTitle")}</div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "var(--gold-tint)", color: "var(--gold-dark)" }}>{t("soon")}</span>
        </div>
        <div style={{ fontSize: 12.8, color: "var(--muted)", marginBlockEnd: 14 }}>{t("packsDesc")}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {PACKS.map((p) => (
            <div key={p.credits} style={{ flex: "1 1 130px", border: "1px solid var(--border)", borderRadius: 12, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>{nf.format(p.credits)}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBlock: "2px 8px" }}>{t("credits")}</div>
              <button disabled style={{ ...btnGhost, width: "100%", height: 34, fontSize: 12.5, opacity: 0.55, cursor: "not-allowed" }}>${p.price}</button>
            </div>
          ))}
        </div>
      </section>

      {/* Affiliate — real code/link */}
      <section style={cardStyle} className="lift">
        <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 4 }}>{t("affiliateTitle")}</div>
        <div style={{ fontSize: 12.8, color: "var(--muted)", marginBlockEnd: 12 }}>{t("affiliateDesc")}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <a href={referralUrl} target="_blank" rel="noopener noreferrer" dir="ltr" style={{ flex: 1, minWidth: 180, fontSize: 13, color: "var(--teal-deep)", fontWeight: 600, textDecoration: "none", fontFamily: "var(--font-latin)", wordBreak: "break-all" }}>{referralUrl}</a>
          <button onClick={copyRef} style={{ ...btnGold, height: 38 }}>{t("copyLink")}</button>
        </div>
      </section>
    </div>
  );
}
