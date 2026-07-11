"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { signIn, signUp } from "@/lib/auth/actions";
import { Logo, BrandWord } from "@/components/Logo";

export function AuthForm() {
  const t = useTranslations("Auth");
  const brand = useTranslations("Brand");
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    start(async () => {
      const fn = mode === "login" ? signIn : signUp;
      const r = await fn({ email, password });
      if (!r.ok) {
        setError(r.error || t("genericError"));
        return;
      }
      if (r.needsConfirm) {
        setInfo(t("checkEmail"));
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 400, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: 28, animation: "floatUp .4s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 22 }}>
          <Logo size={38} />
          <BrandWord name={brand("name")} ai={brand("ai")} tagline={brand("tagline")} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 18 }}>
          {mode === "login" ? t("loginTitle") : t("signupTitle")}
        </h1>

        <label style={label}>{t("email")}</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...field, direction: "ltr", textAlign: "start", fontFamily: "var(--font-latin)" }} />

        <label style={{ ...label, marginBlockStart: 14 }}>{t("password")}</label>
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...field, direction: "ltr", textAlign: "start", fontFamily: "var(--font-latin)" }} />

        {error && <p style={errStyle}>{error}</p>}
        {info && <p style={infoStyle}>{info}</p>}

        <button type="submit" disabled={pending} style={{ ...primaryBtn, opacity: pending ? 0.7 : 1 }}>
          {pending ? t("working") : mode === "login" ? t("login") : t("signup")}
        </button>
        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setInfo(null); }}
          style={{ width: "100%", marginBlockStart: 12, background: "none", border: "none", color: "var(--teal-deep)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}
        >
          {mode === "login" ? t("toSignup") : t("toLogin")}
        </button>
        {mode === "login" && (
          <div style={{ textAlign: "center", marginBlockStart: 10 }}>
            <Link href="/forgot-password" style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>
              {t("forgotLink")}
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}

const label: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--slate)", marginBlockEnd: 7 };
const field: React.CSSProperties = { width: "100%", height: 46, border: "1px solid var(--border-2)", borderRadius: "var(--r)", background: "var(--card)", padding: "0 14px", fontSize: 14.5, color: "var(--text)", outline: "none" };
const primaryBtn: React.CSSProperties = { marginBlockStart: 18, width: "100%", height: 50, background: "linear-gradient(135deg,#102A43,#0B1F33)", color: "#fff", border: "none", borderRadius: 13, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 12px 26px -12px rgba(11,31,51,.7)" };
const errStyle: React.CSSProperties = { marginBlockStart: 12, fontSize: 13, color: "var(--coral)", background: "var(--coral-tint)", border: "1px solid rgba(224,101,74,.25)", borderRadius: 10, padding: "10px 14px", lineHeight: 1.7 };
const infoStyle: React.CSSProperties = { marginBlockStart: 12, fontSize: 13, color: "var(--teal-deep)", background: "var(--teal-tint-2)", border: "1px solid rgba(20,184,166,.3)", borderRadius: 10, padding: "10px 14px", lineHeight: 1.7 };
