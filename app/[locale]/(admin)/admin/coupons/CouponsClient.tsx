"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createCouponAction, toggleCouponAction } from "../actions";

export type CouponRow = { id: string; code: string; credits: number; maxRedemptions: number; redemptions: number; active: string; expiresAt: string | null };

export function CouponsClient({ coupons, locale }: { coupons: CouponRow[]; locale: string }) {
  const t = useTranslations("Admin");
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("100");
  const [max, setMax] = useState("1");
  const [err, setErr] = useState("");

  const create = () =>
    start(async () => {
      setErr("");
      const r = await createCouponAction({ code, credits: parseInt(credits, 10) || 0, maxRedemptions: parseInt(max, 10) || 0 });
      if (r.ok) { setCode(""); setCredits("100"); setMax("1"); router.refresh(); }
      else setErr(r.error === "code_exists" ? t("errCodeExists") : r.error === "bad_input" ? t("errBadInput") : t("errGeneric"));
    });

  const toggle = (id: string, active: boolean) => start(async () => { await toggleCouponAction(id, active); router.refresh(); });

  return (
    <div>
      {/* Create */}
      <div style={{ background: "var(--card,#fff)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBlockEnd: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--heading)", marginBlockEnd: 12 }}>{t("createCoupon")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <Field label={t("couponCode")}>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME50" style={{ width: 160, height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", fontFamily: "var(--font-latin)", textTransform: "uppercase" }} />
          </Field>
          <Field label={t("couponCredits")}>
            <input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} style={{ width: 100, height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", fontFamily: "var(--font-latin)" }} />
          </Field>
          <Field label={t("couponMax")}>
            <input type="number" value={max} onChange={(e) => setMax(e.target.value)} style={{ width: 100, height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", fontFamily: "var(--font-latin)" }} />
          </Field>
          <button onClick={create} disabled={pending} style={{ height: 40, padding: "0 20px", borderRadius: 10, border: "none", cursor: "pointer", background: "var(--teal)", color: "#fff", fontSize: 13, fontWeight: 700 }}>{t("create")}</button>
        </div>
        {err && <div style={{ fontSize: 12.5, color: "var(--coral,#dc2626)", marginBlockStart: 10 }}>{err}</div>}
      </div>

      {/* List */}
      <div style={{ display: "grid", gap: 8 }}>
        {coupons.map((c) => {
          const active = c.active === "yes";
          const exhausted = c.redemptions >= c.maxRedemptions;
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-latin)", fontWeight: 800, fontSize: 15, color: "var(--heading)", letterSpacing: ".5px" }}>{c.code}</span>
              <span style={{ fontSize: 12.5, color: "var(--teal-deep)", fontWeight: 700, background: "var(--teal-tint)", padding: "3px 10px", borderRadius: 999 }}>+{nf.format(c.credits)}</span>
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-latin)" }}>{nf.format(c.redemptions)}/{nf.format(c.maxRedemptions)}</span>
              {exhausted && <span style={{ fontSize: 11, color: "var(--gold-dark)", fontWeight: 600 }}>{t("couponExhausted")}</span>}
              <span style={{ flex: 1 }} />
              <button onClick={() => toggle(c.id, !active)} disabled={pending} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: `1px solid ${active ? "var(--border-2)" : "var(--teal)"}`, cursor: "pointer", background: active ? "var(--card)" : "var(--teal-tint)", color: active ? "var(--muted)" : "var(--teal-deep)", fontSize: 12, fontWeight: 700 }}>
                {active ? t("deactivate") : t("activateCoupon")}
              </button>
            </div>
          );
        })}
        {coupons.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13.5, padding: 30 }}>{t("noCoupons")}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>{label}</span>
      {children}
    </label>
  );
}
