"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { onboardToDna, type OnboardResult } from "./actions";

const QUESTION_KEYS = ["q1", "q2", "q3", "q4"] as const;

export function OnboardingClient() {
  const t = useTranslations("Onboarding");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");

  const [mode, setMode] = useState<"paste" | "interview">("interview");
  const [paste, setPaste] = useState("");
  const [answers, setAnswers] = useState<string[]>(["", "", "", ""]);
  const [result, setResult] = useState<OnboardResult | null>(null);
  const [pending, startTransition] = useTransition();

  function samples(): string {
    if (mode === "paste") return paste;
    return answers.map((a) => a.trim()).filter(Boolean).join("\n\n");
  }

  function onGenerate() {
    setResult(null);
    const s = samples();
    startTransition(async () => {
      setResult(await onboardToDna({ samples: s }));
    });
  }

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 13px", borderRadius: 999, background: "var(--teal-tint-2)", border: "1px solid rgba(20,184,166,.32)", fontSize: 12.5, fontWeight: 600, color: "var(--teal-deep)", marginBlockEnd: 16 }}>
        ✦ {t("badge")}
      </div>
      <h1 style={{ fontSize: "clamp(24px,4vw,30px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.8, marginBlock: "8px 22px" }}>{t("subtitle")}</p>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 8, marginBlockEnd: 16 }}>
        {(["interview", "paste"] as const).map((m) => {
          const on = mode === m;
          return (
            <button
              key={m}
              onClick={() => { setMode(m); setResult(null); }}
              style={{ padding: "10px 18px", borderRadius: 11, cursor: "pointer", fontSize: 14, fontWeight: 600, border: on ? "1.5px solid var(--teal)" : "1.5px solid var(--border-2)", background: on ? "var(--teal-tint-2)" : "var(--card)", color: on ? "var(--navy)" : "var(--slate)" }}
            >
              {t(m === "interview" ? "tabInterview" : "tabPaste")}
            </button>
          );
        })}
      </div>

      <section style={card}>
        {mode === "interview" ? (
          <div style={{ display: "grid", gap: 16 }}>
            {QUESTION_KEYS.map((q, i) => (
              <div key={q}>
                <label style={label}>{t(q)}</label>
                <textarea
                  value={answers[i]}
                  onChange={(e) => setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))}
                  placeholder={t("answerPlaceholder")}
                  rows={i >= 2 ? 3 : 2}
                  className="scb"
                  style={{ ...field, lineHeight: 1.8 }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div>
            <label style={label}>{t("pasteLabel")}</label>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={t("pastePlaceholder")} rows={8} className="scb" style={{ ...field, lineHeight: 1.8 }} />
          </div>
        )}

        <button onClick={onGenerate} disabled={pending} style={{ ...primaryBtn, opacity: pending ? 0.7 : 1 }}>
          {pending ? t("generating") : t("generate")}
        </button>

        {result && !result.ok && (
          <p style={notice}>
            {result.error === "no_key" ? t("needKey") : result.error === "too_few" ? t("tooFew") : result.error === "insufficient_credits" ? t("insufficientCredits") : `${t("error")}${result.message ? ` (${result.message})` : ""}`}
          </p>
        )}
      </section>

      {result?.ok && (
        <section style={{ ...card, marginBlockStart: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBlockEnd: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: "var(--teal)" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--heading)" }}>{t("resultTitle")}</h2>
          </div>
          <p style={{ fontSize: 14.5, color: "var(--slate)", lineHeight: 1.9, marginBlockEnd: 14 }}>{result.dna.summary}</p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBlockEnd: 14 }}>
            {result.dna.dialect && <span style={pill("var(--teal-tint)", "var(--teal-deep)")}>{result.dna.dialect}</span>}
            {result.dna.tone_traits.map((x, i) => <span key={i} style={pill("var(--gold-tint)", "var(--gold-dark)")}>{x}</span>)}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 18 }}>
            <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(0, Math.min(100, result.dna.completion_pct))}%`, height: "100%", background: "linear-gradient(90deg,var(--teal),var(--teal-dark))" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--teal-deep)" }}>{nf.format(result.dna.completion_pct)}%</span>
          </div>

          <Link href="/studio" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 48, padding: "0 24px", borderRadius: 12, background: "linear-gradient(135deg,#102A43,#0B1F33)", color: "#fff", fontWeight: 700, fontSize: 14.5, boxShadow: "0 12px 26px -12px rgba(11,31,51,.7)" }}>
            {t("toStudio")} →
          </Link>
          <p style={{ marginBlockStart: 12, fontSize: 11.5, color: "var(--subtle)", fontFamily: "var(--font-latin)" }}>{result.model}</p>
        </section>
      )}
    </main>
  );
}

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "clamp(16px,3vw,24px)" };
const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--slate)", marginBlockEnd: 7 };
const field: React.CSSProperties = { width: "100%", border: "1px solid var(--border-2)", borderRadius: "var(--r)", background: "var(--card)", padding: "10px 14px", fontSize: 14.5, color: "var(--text)", outline: "none", resize: "vertical" };
const primaryBtn: React.CSSProperties = { marginBlockStart: 18, width: "100%", height: 50, background: "linear-gradient(135deg,#102A43,#0B1F33)", color: "#fff", border: "none", borderRadius: 13, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 12px 26px -12px rgba(11,31,51,.7)" };
const notice: React.CSSProperties = { marginBlockStart: 12, fontSize: 13, color: "var(--coral)", background: "var(--coral-tint)", border: "1px solid rgba(224,101,74,.25)", borderRadius: 10, padding: "10px 14px", lineHeight: 1.7 };
function pill(bg: string, color: string): React.CSSProperties {
  return { display: "inline-block", padding: "5px 11px", borderRadius: 999, background: bg, color, fontSize: 12.5, fontWeight: 600 };
}
