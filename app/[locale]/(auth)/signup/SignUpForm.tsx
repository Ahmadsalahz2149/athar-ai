"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { signUp } from "@/lib/auth/actions";
import { Logo } from "@/components/Logo";
import { OAuthButtons, OAUTH_AVAILABLE } from "@/components/auth/OAuthButtons";
import { PasswordInput, strength } from "@/components/auth/PasswordInput";
import { SelectableCard, btnNavy } from "@/components/ui/display";

const TYPES = ["course_owner", "coach", "creator", "agency"] as const;

export function SignUpForm() {
  const t = useTranslations("Auth");
  const brand = useTranslations("Brand");
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accountType, setAccountType] = useState<string>("course_owner");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password !== confirm) return setError(t("passwordMismatch"));
    start(async () => {
      const r = await signUp({ email, password, fullName, accountType });
      if (!r.ok) return setError(r.error);
      if (r.needsConfirm) return setInfo(t("confirmEmail"));
      router.push("/onboarding/1");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 10, marginBlockEnd: 24 }}>
        <Logo size={38} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "var(--heading)" }}>
            {brand("name")}
            <span style={{ color: "var(--teal-deep)" }}> {brand("ai")}</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-latin)" }}>Personal Brand Growth OS</div>
        </div>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("signupTitle")}</h1>
      <p style={{ color: "var(--muted)", marginBlock: "8px 20px", lineHeight: 1.7, fontSize: 14.5 }}>{t("signupSub")}</p>

      {OAUTH_AVAILABLE && <>
        <OAuthButtons />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBlock: 18 }}>
          <span style={{ flex: 1, height: 1, background: "var(--border-2)" }} />
          <span style={{ fontSize: 12, color: "var(--subtle)" }}>{t("orEmail")}</span>
          <span style={{ flex: 1, height: 1, background: "var(--border-2)" }} />
        </div>
      </>}

      <label style={label}>{t("fullName")}</label>
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("fullNamePh")} style={field} />

      <label style={{ ...label, marginBlockStart: 14 }}>{t("email")}</label>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ ...field, direction: "ltr", textAlign: "start", fontFamily: "var(--font-latin)" }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 12, marginBlockStart: 14 }}>
        <div>
          <label style={label}>{t("password")}</label>
          <PasswordInput value={password} onChange={setPassword} showLabel={t("showPassword")} hideLabel={t("hidePassword")} />
          {password.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginBlockStart: 7 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i < strength(password) ? ["var(--coral)", "var(--gold)", "var(--teal)"][strength(password) - 1] : "var(--border-2)" }} />
              ))}
            </div>
          )}
        </div>
        <div>
          <label style={label}>{t("confirmPassword")}</label>
          <PasswordInput value={confirm} onChange={setConfirm} showLabel={t("showPassword")} hideLabel={t("hidePassword")} />
          {confirm.length > 0 && confirm !== password && (
            <div style={{ fontSize: 11.5, color: "var(--coral)", marginBlockStart: 6 }}>{t("passwordMismatch")}</div>
          )}
        </div>
      </div>

      <div style={{ marginBlockStart: 18 }}>
        <label style={label}>{t("accountType")}</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,140px),1fr))", gap: 10, marginBlockStart: 8 }}>
          {TYPES.map((ty) => (
            <SelectableCard key={ty} title={t(`type_${ty}`)} active={accountType === ty} onClick={() => setAccountType(ty)} />
          ))}
        </div>
      </div>

      {error && <p style={errStyle}>{error}</p>}
      {info && <p style={infoStyle}>{info}</p>}

      <button type="submit" disabled={pending} style={{ ...btnNavy, width: "100%", height: 50, marginBlockStart: 18, fontSize: 15, opacity: pending ? 0.7 : 1 }}>
        {pending ? t("working") : `${t("signup")} ←`}
      </button>

      <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--muted)", marginBlockStart: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7z" stroke="var(--teal-deep)" strokeWidth="1.8" strokeLinejoin="round" /></svg>
        {t("freeTrialNote")}
      </p>
      <p style={{ textAlign: "center", fontSize: 13.5, color: "var(--muted)", marginBlockStart: 12 }}>
        {t("haveAccount")}{" "}
        <Link href="/login" style={{ color: "var(--gold-dark)", fontWeight: 700, textDecoration: "underline" }}>{t("login")}</Link>
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
const infoStyle: React.CSSProperties = { marginBlockStart: 14, padding: "10px 13px", borderRadius: 10, background: "var(--teal-tint-2)", color: "var(--teal-deep)", fontSize: 13.5 };
