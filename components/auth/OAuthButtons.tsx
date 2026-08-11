"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/** LinkedIn + Google buttons exactly as designed. They call Supabase OAuth —
 * if the provider isn't enabled yet the error is surfaced inline (no silent
 * dead button). Enabling the providers is a Supabase dashboard step. */
export function OAuthButtons() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [err, setErr] = useState<string | null>(null);

  const go = async (provider: "linkedin_oidc" | "google") => {
    setErr(null);
    const supabase = getSupabaseBrowser();
    if (!supabase) return setErr(t("oauthUnavailable"));
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/${locale}/dashboard` },
    });
    if (error) setErr(t("oauthUnavailable"));
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,130px),1fr))", gap: 12 }}>
        <button type="button" onClick={() => go("linkedin_oidc")} style={oauthBtn}>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>LinkedIn</span>
          <span style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 4, background: "#0A66C2", color: "#fff", fontSize: 10.5, fontWeight: 800, fontFamily: "var(--font-latin)" }}>in</span>
        </button>
        <button type="button" onClick={() => go("google")} style={oauthBtn}>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>Google</span>
          <svg width="17" height="17" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 6.9l7.1 5.5c4.2-3.8 6.6-9.5 6.6-16.9z" />
            <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.3 0 20 0 24s1 7.7 2.6 10.8l7.8-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.3-4.6 2.1-8.8 2.1-6.4 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
        </button>
      </div>
      {err && <p style={{ marginBlockStart: 10, fontSize: 12.5, color: "var(--coral)" }}>{err}</p>}
    </>
  );
}

const oauthBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  height: 46,
  borderRadius: 12,
  border: "1px solid var(--border-2)",
  background: "var(--card)",
  color: "var(--text)",
  cursor: "pointer",
};
