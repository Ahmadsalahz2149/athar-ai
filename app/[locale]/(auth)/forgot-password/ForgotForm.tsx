"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { requestPasswordReset } from "@/lib/auth/actions";

export function ForgotForm() {
  const t = useTranslations("Auth");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div style={{ width: "100%", maxWidth: 400 }}>
      {sent ? (
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 54, height: 54, margin: "0 auto 14px", borderRadius: 14, display: "grid", placeItems: "center", background: "var(--teal-tint)" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 6h16v12H4zM4 7l8 6 8-6" stroke="#0E9488" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--heading)" }}>{t("resetSentTitle")}</h1>
          <p style={{ color: "var(--muted)", marginBlock: "8px 20px", lineHeight: 1.7 }}>{t("resetSentBody")}</p>
          <Link href="/login" style={{ color: "var(--teal-deep)", fontWeight: 700 }}>{t("backToLogin")}</Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await requestPasswordReset(email);
              setSent(true);
            });
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--heading)" }}>{t("forgotTitle")}</h1>
          <p style={{ color: "var(--muted)", marginBlock: "8px 20px", lineHeight: 1.7 }}>{t("forgotBody")}</p>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--slate)" }}>{t("email")}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", height: 46, padding: "0 14px", borderRadius: 12, border: "1px solid var(--border-2)", background: "var(--card)", fontSize: 14.5, outline: "none", marginBlock: "8px 16px" }}
          />
          <button type="submit" disabled={pending} style={{ width: "100%", height: 48, borderRadius: 12, border: "none", cursor: pending ? "default" : "pointer", background: "linear-gradient(135deg,#102A43,#0B1F33)", color: "#fff", fontWeight: 700, fontSize: 15, opacity: pending ? 0.7 : 1 }}>
            {pending ? "…" : t("sendReset")}
          </button>
          <div style={{ textAlign: "center", marginBlockStart: 16 }}>
            <Link href="/login" style={{ color: "var(--teal-deep)", fontWeight: 600, fontSize: 13.5 }}>{t("backToLogin")}</Link>
          </div>
        </form>
      )}
    </div>
  );
}
