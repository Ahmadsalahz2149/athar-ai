"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { adjustCreditsAction, toggleSuspendAction } from "../../actions";

export function OrgActions({ orgId, suspended, balance }: { orgId: string; suspended: boolean; balance: number }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  const adjust = (sign: 1 | -1) =>
    start(async () => {
      setMsg("");
      const n = Math.abs(parseInt(amount, 10) || 0) * sign;
      if (!n) { setMsg(t("errAmount")); return; }
      const r = await adjustCreditsAction(orgId, n, note);
      if (r.ok) { setAmount(""); setNote(""); setMsg(t("creditsUpdated", { balance: r.balance ?? 0 })); router.refresh(); }
      else setMsg(t("errGeneric"));
    });

  const toggle = () =>
    start(async () => {
      setMsg("");
      const r = await toggleSuspendAction(orgId, !suspended);
      if (r.ok) router.refresh();
      else setMsg(t("errGeneric"));
    });

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Credit adjustment */}
      <div style={{ background: "var(--card,#fff)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--heading)", marginBlockEnd: 4 }}>{t("adjustCredits")}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBlockEnd: 12 }}>{t("currentBalance", { balance })}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("amount")} style={{ width: 120, height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", fontFamily: "var(--font-latin)" }} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("noteOptional")} style={{ flex: 1, minWidth: 140, height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13.5, outline: "none", fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBlockStart: 10 }}>
          <button onClick={() => adjust(1)} disabled={pending} style={{ height: 38, padding: "0 18px", borderRadius: 10, border: "none", cursor: "pointer", background: "var(--teal)", color: "#fff", fontSize: 13, fontWeight: 700 }}>+ {t("add")}</button>
          <button onClick={() => adjust(-1)} disabled={pending} style={{ height: 38, padding: "0 18px", borderRadius: 10, border: "1px solid var(--border-2)", cursor: "pointer", background: "var(--card)", color: "var(--slate)", fontSize: 13, fontWeight: 700 }}>− {t("deduct")}</button>
        </div>
        {msg && <div style={{ fontSize: 12.5, color: "var(--teal-deep)", marginBlockStart: 10 }}>{msg}</div>}
      </div>

      {/* Suspend / activate */}
      <div style={{ background: "var(--card,#fff)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--heading)" }}>{suspended ? t("accountSuspended") : t("accountActive")}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBlockStart: 2 }}>{suspended ? t("suspendedHint") : t("activeHint")}</div>
        </div>
        <button onClick={toggle} disabled={pending} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: suspended ? "var(--teal)" : "var(--coral,#dc2626)", color: "#fff" }}>
          {suspended ? t("activate") : t("suspend")}
        </button>
      </div>
    </div>
  );
}
