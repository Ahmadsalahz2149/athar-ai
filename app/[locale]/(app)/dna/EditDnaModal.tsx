"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { saveDnaEdits, type DnaEdits } from "./actions";
import { btnNavy, btnGhost } from "@/components/ui/display";

const PILLAR_KEYS = ["educational", "story", "proof", "soft_sell", "thought_leadership", "engagement"] as const;

type Labels = {
  edit: string; title: string; save: string; cancel: string; saving: string;
  tone: string; dialect: string; explain: string; dos: string; donts: string;
  hooks: string; ctas: string; pillars: string; linesHint: string;
  sumOk: string; sumBad: string; saveError: string;
  pillar: Record<string, string>;
};

const toLines = (xs: string[]) => xs.join("\n");
const fromLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function EditDnaModal({
  initial,
  labels,
}: {
  initial: DnaEdits;
  labels: Labels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [tone, setTone] = useState(toLines(initial.tone_traits));
  const [dialect, setDialect] = useState(initial.dialect);
  const [explain, setExplain] = useState(initial.explanation_style);
  const [dos, setDos] = useState(toLines(initial.dos));
  const [donts, setDonts] = useState(toLines(initial.donts));
  const [hooks, setHooks] = useState(toLines(initial.hook_patterns));
  const [ctas, setCtas] = useState(toLines(initial.cta_patterns));
  const [pillars, setPillars] = useState<Record<string, number>>({ ...initial.pillars });

  const sum = PILLAR_KEYS.reduce((a, k) => a + (pillars[k] || 0), 0);
  const sumOk = sum === 100;

  const submit = () => {
    if (!sumOk) return;
    setErr(null);
    start(async () => {
      const r = await saveDnaEdits({
        tone_traits: fromLines(tone),
        dialect,
        explanation_style: explain,
        dos: fromLines(dos),
        donts: fromLines(donts),
        hook_patterns: fromLines(hooks),
        cta_patterns: fromLines(ctas),
        pillars: pillars as DnaEdits["pillars"],
      });
      if (!r.ok) return setErr(labels.saveError);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={btnNavy}>{labels.edit}</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={labels.title} onClick={() => !pending && setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(11,31,51,.5)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 16, zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "min(680px,100%)", maxHeight: "88vh", overflowY: "auto", background: "var(--card)", borderRadius: 18, border: "1px solid var(--border)", padding: 22 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 16 }}>{labels.title}</h2>

            <Field label={labels.dialect}><input value={dialect} onChange={(e) => setDialect(e.target.value)} style={inp} /></Field>
            <Field label={labels.explain}><input value={explain} onChange={(e) => setExplain(e.target.value)} style={inp} /></Field>
            <Field label={labels.tone} hint={labels.linesHint}><textarea value={tone} onChange={(e) => setTone(e.target.value)} rows={3} style={ta} /></Field>
            <Field label={labels.dos} hint={labels.linesHint}><textarea value={dos} onChange={(e) => setDos(e.target.value)} rows={3} style={ta} /></Field>
            <Field label={labels.donts} hint={labels.linesHint}><textarea value={donts} onChange={(e) => setDonts(e.target.value)} rows={3} style={ta} /></Field>
            <Field label={labels.hooks} hint={labels.linesHint}><textarea value={hooks} onChange={(e) => setHooks(e.target.value)} rows={3} style={ta} /></Field>
            <Field label={labels.ctas} hint={labels.linesHint}><textarea value={ctas} onChange={(e) => setCtas(e.target.value)} rows={3} style={ta} /></Field>

            <div style={{ marginBlock: "6px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--slate)" }}>{labels.pillars}</label>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-latin)", padding: "3px 10px", borderRadius: 999, background: sumOk ? "var(--teal-tint-2)" : "var(--coral-tint)", color: sumOk ? "var(--teal-deep)" : "var(--coral)" }}>
                {sum}% — {sumOk ? labels.sumOk : labels.sumBad}
              </span>
            </div>
            <div style={{ display: "grid", gap: 8, marginBlockEnd: 14 }}>
              {PILLAR_KEYS.map((k) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--slate)" }}>{labels.pillar[k]}</span>
                  <input type="range" min={0} max={100} step={1} value={pillars[k] || 0}
                    onChange={(e) => setPillars((p) => ({ ...p, [k]: Number(e.target.value) }))}
                    style={{ flex: 2, accentColor: "var(--teal)" }} />
                  <span style={{ width: 42, textAlign: "end", fontSize: 12.5, fontWeight: 700, fontFamily: "var(--font-latin)", color: "var(--heading)" }}>{pillars[k] || 0}%</span>
                </div>
              ))}
            </div>

            {err && <p style={{ padding: "9px 12px", borderRadius: 10, background: "var(--coral-tint)", color: "var(--coral)", fontSize: 13, marginBlockEnd: 12 }}>{err}</p>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setOpen(false)} disabled={pending} style={btnGhost}>{labels.cancel}</button>
              <button onClick={submit} disabled={pending || !sumOk} style={{ ...btnNavy, opacity: pending || !sumOk ? 0.55 : 1 }}>{pending ? labels.saving : labels.save}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBlockEnd: 12 }}>
      <label style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--slate)", marginBlockEnd: 6 }}>
        <span>{label}</span>
        {hint && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--subtle)" }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", height: 42, padding: "0 12px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", fontSize: 14, outline: "none", fontFamily: "inherit" };
const ta: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", fontSize: 14, outline: "none", resize: "vertical", lineHeight: 1.7, fontFamily: "inherit" };
