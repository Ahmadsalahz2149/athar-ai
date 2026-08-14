"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ScoreRadial, btnTeal } from "@/components/ui/display";
import { dnaMatch } from "@/lib/ai/score";
import type { ContentDna } from "@/lib/ai/prompts";
import { voiceFeedback } from "./actions";

/** Paste any text → see instantly how on-brand it is (local heuristic score),
 * then get a specific AI critique of what fits your voice and what breaks it. */
export function VoiceTest({ dna }: { dna: ContentDna }) {
  const t = useTranslations("Dna");
  const [text, setText] = useState("");
  const [fb, setFb] = useState<{ matches: string[]; breaks: string[]; tip: string } | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  // Instant, free, client-side match score as you type.
  const score = useMemo(() => (text.trim().length >= 8 ? dnaMatch(text, dna) : 0), [text, dna]);
  const tone = score >= 75 ? "var(--teal)" : score >= 55 ? "var(--gold)" : "var(--coral)";

  const getFeedback = () =>
    start(async () => {
      setErr(""); setFb(null);
      const r = await voiceFeedback(text);
      if (r.ok) setFb({ matches: r.matches, breaks: r.breaks, tip: r.tip });
      else setErr(r.error === "insufficient_credits" ? t("errCredits") : r.error === "no_key" ? t("needKey") : r.error === "empty" ? t("vtShort") : t("errGeneric"));
    });

  return (
    <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, marginBlockStart: 18 }} className="lift">
      <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--heading)" }}>{t("vtTitle")}</div>
      <div style={{ fontSize: 12.8, color: "var(--muted)", marginBlock: "3px 12px" }}>{t("vtDesc")}</div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setFb(null); }}
          placeholder={t("vtPh")}
          rows={4}
          style={{ flex: 1, minWidth: 220, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, color: "var(--heading)", fontFamily: "inherit", resize: "vertical" }}
        />
        <div style={{ display: "grid", placeItems: "center", gap: 4, minWidth: 96 }}>
          <ScoreRadial value={score} size={90} suffix="%" valueColor={tone} track="var(--border-3)" label={t("vtMatch")} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBlockStart: 12, flexWrap: "wrap" }}>
        <button onClick={getFeedback} disabled={pending || text.trim().length < 10} style={{ ...btnTeal, height: 40 }}>{pending ? t("vtAnalyzing") : t("vtFeedback")}</button>
        {score > 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("vtInstant")}</span>}
      </div>

      {err && <div style={{ marginBlockStart: 10, fontSize: 13, color: "var(--coral)" }}>{err}</div>}
      {fb && (
        <div style={{ marginBlockStart: 14, display: "grid", gap: 10 }}>
          {fb.matches.length > 0 && (
            <div style={{ padding: "11px 13px", borderRadius: 11, background: "var(--teal-tint)", border: "1px solid var(--teal)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--teal-deep)", marginBlockEnd: 5 }}>✓ {t("vtMatches")}</div>
              {fb.matches.map((m, i) => <div key={i} style={{ fontSize: 13, color: "var(--ink2,var(--slate))", lineHeight: 1.7 }}>• {m}</div>)}
            </div>
          )}
          {fb.breaks.length > 0 && (
            <div style={{ padding: "11px 13px", borderRadius: 11, background: "var(--coral-tint)", border: "1px solid var(--coral)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--coral)", marginBlockEnd: 5 }}>⚠ {t("vtBreaks")}</div>
              {fb.breaks.map((m, i) => <div key={i} style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.7 }}>• {m}</div>)}
            </div>
          )}
          {fb.tip && (
            <div style={{ padding: "11px 13px", borderRadius: 11, background: "var(--gold-tint)", border: "1px solid var(--brass-line,var(--gold))" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--gold-dark)", marginBlockEnd: 4 }}>{t("vtTip")}</div>
              <div style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.75 }}>{fb.tip}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
