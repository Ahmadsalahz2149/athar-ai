"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { generateStudio, type GenerateResult } from "./actions";

const PLATFORMS = ["LinkedIn", "X / Twitter", "Instagram"] as const;

export function StudioClient() {
  const t = useTranslations("Studio");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");

  const [posts, setPosts] = useState("");
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<string>(PLATFORMS[0]);
  const [count, setCount] = useState(3);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [activeDraft, setActiveDraft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function onGenerate() {
    setResult(null);
    setActiveDraft(0);
    startTransition(async () => {
      const r = await generateStudio({ posts, topic, platform, count });
      setResult(r);
    });
  }

  const drafts = result?.ok ? result.drafts : [];
  const current = drafts[activeDraft];

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "clamp(24px,5vw,44px) clamp(16px,5vw,32px) 90px",
        animation: "floatUp .4s ease",
      }}
    >
      <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>
        {t("title")}
      </h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, marginBlock: "6px 24px" }}>
        {t("subtitle")}
      </p>

      {/* Input card */}
      <section style={card}>
        <label style={labelStyle}>{t("postsLabel")}</label>
        <textarea
          value={posts}
          onChange={(e) => setPosts(e.target.value)}
          placeholder={t("postsPlaceholder")}
          className="scb"
          rows={7}
          style={{ ...field, resize: "vertical", lineHeight: 1.8 }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBlockStart: 14 }}>
          <div>
            <label style={labelStyle}>{t("topicLabel")}</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t("topicPlaceholder")}
              style={field}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr .6fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>{t("platformLabel")}</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={field}>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t("countLabel")}</label>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))} style={field}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {nf.format(n)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button onClick={onGenerate} disabled={pending} style={{ ...primaryBtn, opacity: pending ? 0.7 : 1 }}>
          {pending ? t("generating") : t("generate")}
        </button>

        {result && !result.ok && (
          <p style={noticeStyle}>
            {result.error === "no_key"
              ? t("needKey")
              : result.error === "too_few_posts"
                ? t("needPosts")
                : result.error === "truncated"
                  ? t("truncated")
                  : `${t("errorGeneric")}${result.message ? ` (${result.message})` : ""}`}
          </p>
        )}
      </section>

      {result?.ok && (
        <>
          {/* DNA card */}
          <section style={{ ...card, marginBlockStart: 22 }}>
            <div style={sectionHead}>
              <span style={dot("var(--teal)")} />
              {t("dnaTitle")}
            </div>
            <p style={{ fontSize: 14.5, color: "var(--slate)", lineHeight: 1.85, marginBlockEnd: 16 }}>
              {result.dna.summary}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
              <Field label={t("dnaDialect")}>
                <span style={pill("var(--teal-tint)", "var(--teal-deep)")}>{result.dna.dialect}</span>
              </Field>
              <Field label={t("dnaAudience")}>
                <span style={{ fontSize: 13.5, color: "var(--slate)" }}>{result.dna.audience}</span>
              </Field>
            </div>

            <Field label={t("dnaTone")}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {(result.dna.tone_traits ?? []).map((tr, i) => (
                  <span key={i} style={pill("var(--gold-tint)", "var(--gold-dark)")}>
                    {tr}
                  </span>
                ))}
              </div>
            </Field>

            <Field label={t("dnaHooks")}>
              <ul style={{ margin: 0, paddingInlineStart: 18, color: "var(--slate)", fontSize: 13.5, lineHeight: 1.9 }}>
                {(result.dna.hook_patterns ?? []).map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </Field>

            <Field label={t("dnaCompletion")}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 8, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, result.dna.completion_pct))}%`,
                      height: "100%",
                      background: "linear-gradient(90deg,var(--teal),var(--teal-dark))",
                    }}
                  />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--teal-deep)" }}>
                  {nf.format(result.dna.completion_pct)}%
                </span>
              </div>
            </Field>
          </section>

          {/* Drafts */}
          <section style={{ ...card, marginBlockStart: 22 }}>
            <div style={sectionHead}>
              <span style={dot("var(--gold)")} />
              {t("draftsTitle")}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBlockEnd: 14 }}>
              {drafts.map((_, i) => {
                const on = i === activeDraft;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setActiveDraft(i);
                      setCopied(false);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      border: on ? "1.5px solid var(--teal)" : "1.5px solid var(--border-2)",
                      background: on ? "var(--teal-tint-2)" : "var(--card)",
                      color: on ? "var(--navy)" : "var(--slate)",
                    }}
                  >
                    {t("draftLabel")} {nf.format(i + 1)}
                  </button>
                );
              })}
            </div>

            {current && (
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 18, background: "var(--surface)" }}>
                <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 16, lineHeight: 1.7, marginBlockEnd: 10 }}>
                  {current.hook}
                </div>
                <div style={{ whiteSpace: "pre-wrap", color: "var(--slate)", fontSize: 14.5, lineHeight: 1.9 }}>
                  {current.body}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`${current.hook}\n\n${current.body}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  style={{
                    marginBlockStart: 14,
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--border-2)",
                    background: "var(--card)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--navy)",
                  }}
                >
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
            )}

            <p style={{ marginBlockStart: 14, fontSize: 11.5, color: "var(--subtle)", fontFamily: "var(--font-latin)" }}>
              {t("meta", { dnaModel: result.meta.dnaModel, draftModel: result.meta.draftModel })}
            </p>
          </section>
        </>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBlockStart: 14 }}>
      <div style={{ ...labelStyle, marginBlockEnd: 8 }}>{label}</div>
      {children}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-lg)",
  padding: "clamp(16px,3vw,24px)",
  boxShadow: "0 1px 0 rgba(0,0,0,.02)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--slate)",
  marginBlockEnd: 7,
};

const field: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  border: "1px solid var(--border-2)",
  borderRadius: "var(--r)",
  background: "var(--card)",
  padding: "10px 14px",
  fontSize: 14.5,
  color: "var(--text)",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  marginBlockStart: 18,
  width: "100%",
  height: 50,
  background: "linear-gradient(135deg,#102A43,#0B1F33)",
  color: "#fff",
  border: "none",
  borderRadius: 13,
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 12px 26px -12px rgba(11,31,51,.7)",
};

const noticeStyle: React.CSSProperties = {
  marginBlockStart: 12,
  fontSize: 13,
  color: "var(--coral)",
  background: "var(--coral-tint)",
  border: "1px solid rgba(224,101,74,.25)",
  borderRadius: 10,
  padding: "10px 14px",
  lineHeight: 1.7,
};

const sectionHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  fontSize: 15,
  fontWeight: 700,
  color: "var(--heading)",
  marginBlockEnd: 14,
};

function dot(color: string): React.CSSProperties {
  return { width: 9, height: 9, borderRadius: 999, background: color, display: "inline-block" };
}

function pill(bg: string, color: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "5px 11px",
    borderRadius: 999,
    background: bg,
    color,
    fontSize: 12.5,
    fontWeight: 600,
  };
}
