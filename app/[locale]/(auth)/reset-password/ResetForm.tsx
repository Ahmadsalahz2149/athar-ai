"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type Phase = "checking" | "ready" | "invalid" | "done";

/**
 * Completes the Supabase password-recovery flow. The email link lands here with
 * a recovery token (PKCE `?code=` or a hash session); we establish that session,
 * then let the user set a new password via `updateUser`. Without this page the
 * whole reset flow dead-ends. Requires: SMTP configured in Supabase, and this
 * URL added to Supabase Auth → URL Configuration → Redirect URLs.
 */
export function ResetForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Establish the recovery session from the URL on mount.
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) { setPhase("invalid"); return; }
    let done = false;
    const markReady = () => { if (!done) { done = true; setPhase("ready"); } };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) markReady();
    });

    (async () => {
      try {
        const code = new URL(window.location.href).searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) { markReady(); return; }
        }
        // Hash-token (implicit) flow is auto-processed by detectSessionInUrl.
        const { data } = await supabase.auth.getSession();
        if (data.session) markReady();
        else setTimeout(() => { if (!done) setPhase("invalid"); }, 1200);
      } catch {
        if (!done) setPhase("invalid");
      }
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    setErr(null);
    if (pw.length < 8) { setErr(t("pwTooShort")); return; }
    if (pw !== confirm) { setErr(t("pwMismatch")); return; }
    const supabase = getSupabaseBrowser();
    if (!supabase) { setErr(t("resetError")); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) { setErr(error.message || t("resetError")); return; }
    setPhase("done");
    setTimeout(() => router.push("/login"), 1600);
  };

  const inp: React.CSSProperties = { width: "100%", height: 46, padding: "0 44px 0 14px", borderRadius: 12, border: "1px solid var(--border-2)", background: "var(--card)", fontSize: 14.5, outline: "none", direction: "ltr", textAlign: "start" };

  return (
    <div style={{ width: "100%", maxWidth: 400 }}>
      {phase === "checking" && (
        <p style={{ color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>{t("resetChecking")}</p>
      )}

      {phase === "invalid" && (
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--heading)" }}>{t("resetInvalidTitle")}</h1>
          <p style={{ color: "var(--muted)", marginBlock: "8px 20px", lineHeight: 1.7 }}>{t("resetInvalidBody")}</p>
          <Link href="/forgot-password" style={{ color: "var(--teal-deep)", fontWeight: 700 }}>{t("forgotTitle")}</Link>
        </div>
      )}

      {phase === "done" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 54, height: 54, margin: "0 auto 14px", borderRadius: 14, display: "grid", placeItems: "center", background: "var(--teal-tint)" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="var(--teal-deep)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--heading)" }}>{t("resetDoneTitle")}</h1>
          <p style={{ color: "var(--muted)", marginBlockStart: 8, lineHeight: 1.7 }}>{t("resetDoneBody")}</p>
        </div>
      )}

      {phase === "ready" && (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--heading)" }}>{t("resetTitle")}</h1>
          <p style={{ color: "var(--muted)", marginBlock: "8px 20px", lineHeight: 1.7 }}>{t("resetBody")}</p>

          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--slate)" }}>{t("newPassword")}</label>
          <div style={{ position: "relative", marginBlock: "8px 14px" }}>
            <input type={show ? "text" : "password"} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} style={inp} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t("hide") : t("showPw")} style={{ position: "absolute", insetInlineEnd: 12, insetBlockStart: 13, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.5" /></svg>
            </button>
          </div>

          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--slate)" }}>{t("confirmPassword")}</label>
          <input type={show ? "text" : "password"} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ ...inp, marginBlock: "8px 4px" }} />

          {err && <p style={{ color: "var(--coral)", fontSize: 13, marginBlockStart: 10 }}>{err}</p>}

          <button type="submit" disabled={saving} style={{ width: "100%", height: 48, borderRadius: 12, border: "none", cursor: saving ? "default" : "pointer", background: "linear-gradient(135deg,var(--navy-2),var(--navy))", color: "#fff", fontWeight: 700, fontSize: 15, opacity: saving ? 0.7 : 1, marginBlockStart: 16 }}>
            {saving ? "…" : t("resetSubmit")}
          </button>
          <div style={{ textAlign: "center", marginBlockStart: 16 }}>
            <Link href="/login" style={{ color: "var(--teal-deep)", fontWeight: 600, fontSize: 13.5 }}>{t("backToLogin")}</Link>
          </div>
        </form>
      )}
    </div>
  );
}
