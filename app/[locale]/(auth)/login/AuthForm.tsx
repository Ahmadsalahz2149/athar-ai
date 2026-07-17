"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { signIn } from "@/lib/auth/actions";
import { Logo } from "@/components/Logo";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { btnNavy } from "@/components/ui/display";

export function AuthForm() {
  const t = useTranslations("Auth");
  const brand = useTranslations("Brand");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await signIn({ email, password });
      if (!r.ok) return setError(r.error);
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 26 }}>
        <Logo size={38} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "var(--heading)" }}>
            {brand("name")}
            <span style={{ color: "var(--teal-deep)" }}> {brand("ai")}</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-latin)" }}>Personal Brand Growth OS</div>
        </div>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("loginTitle")}</h1>
      <p style={{ color: "var(--muted)", marginBlock: "8px 20px", lineHeight: 1.7, fontSize: 14.5 }}>{t("loginSub")}</p>

      <OAuthButtons />

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBlock: 18 }}>
        <span style={{ flex: 1, height: 1, background: "var(--border-2)" }} />
        <span style={{ fontSize: 12, color: "var(--subtle)" }}>{t("or")}</span>
        <span style={{ flex: 1, height: 1, background: "var(--border-2)" }} />
      </div>

      <label style={label}>{t("email")}</label>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ ...field, direction: "ltr", textAlign: "start", fontFamily: "var(--font-latin)" }} />

      <label style={{ ...label, marginBlockStart: 14 }}>{t("password")}</label>
      <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...field, direction: "ltr", textAlign: "start" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBlockStart: 14 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--slate)", cursor: "pointer" }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 17, height: 17, accentColor: "var(--navy)" }} />
          {t("rememberMe")}
        </label>
        <Link href="/forgot-password" style={{ fontSize: 13.5, color: "var(--teal-deep)", fontWeight: 600 }}>{t("forgotLink")}</Link>
      </div>

      {error && <p style={errStyle}>{error}</p>}

      <button type="submit" disabled={pending} style={{ ...btnNavy, width: "100%", height: 50, marginBlockStart: 18, fontSize: 15, opacity: pending ? 0.7 : 1 }}>
        {pending ? t("working") : t("login")}
      </button>

      <p style={{ textAlign: "center", fontSize: 13.5, color: "var(--muted)", marginBlockStart: 16 }}>
        {t("noAccount")}{" "}
        <Link href="/signup" style={{ color: "var(--gold-dark)", fontWeight: 700, textDecoration: "underline" }}>{t("signupTitle")}</Link>
      </p>
    </form>
  );
}

const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--slate)", marginBlockEnd: 7 };
const field: React.CSSProperties = {
  width: "100%",
  height: 46,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid var(--border-2)",
  background: "var(--card)",
  fontSize: 14.5,
  outline: "none",
};
const errStyle: React.CSSProperties = { marginBlockStart: 14, padding: "10px 13px", borderRadius: 10, background: "var(--coral-tint)", color: "var(--coral)", fontSize: 13.5 };
