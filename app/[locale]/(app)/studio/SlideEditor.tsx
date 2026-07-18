"use client";

import { useEffect, useRef, useState } from "react";

/** Splits the draft body into slides on blank lines. No trimming (so spaces the
 * user types mid-edit are preserved); external changes re-split via the effect. */
function splitSlides(body: string): string[] {
  const parts = body.split(/\n{2,}/);
  return parts.length ? parts : [""];
}

type Labels = {
  slide: string; tweet: string; add: string; remove: string; up: string; down: string; overLimit: string;
};

/** Slide-by-slide editor for thread/carousel drafts. Controlled: it owns local
 * slide state but re-syncs whenever `body` changes from outside (regenerate /
 * rewrite / undo), and emits the rejoined body on every edit. */
export function SlideEditor({
  body,
  onChange,
  mode,
  labels,
  nf,
}: {
  body: string;
  onChange: (body: string) => void;
  mode: "thread" | "carousel";
  labels: Labels;
  nf: Intl.NumberFormat;
}) {
  const [slides, setSlides] = useState<string[]>(() => splitSlides(body));
  const lastEmit = useRef(body);

  useEffect(() => {
    if (body !== lastEmit.current) {
      setSlides(splitSlides(body));
      lastEmit.current = body;
    }
  }, [body]);

  const emit = (next: string[]) => {
    const clean = next.length ? next : [""];
    setSlides(clean);
    const joined = clean.join("\n\n");
    lastEmit.current = joined;
    onChange(joined);
  };

  const setAt = (i: number, v: string) => emit(slides.map((s, j) => (j === i ? v : s)));
  const removeAt = (i: number) => emit(slides.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = slides.slice();
    [next[i], next[j]] = [next[j], next[i]];
    emit(next);
  };
  const add = () => emit([...slides, ""]);

  const unit = mode === "thread" ? labels.tweet : labels.slide;
  const limit = mode === "thread" ? 280 : 0; // X post limit; carousel slides are uncapped

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {slides.map((s, i) => {
        const len = s.trim().length;
        const over = limit > 0 && len > limit;
        return (
          <div key={i} style={{ background: "var(--surface)", border: `1px solid ${over ? "var(--coral)" : "var(--border)"}`, borderRadius: 13, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBlockEnd: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "var(--teal-deep)" }}>
                <span style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 6, background: "var(--teal-tint-2)", fontFamily: "var(--font-latin)" }}>{i + 1}</span>
                {unit} {nf.format(i + 1)}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <IconBtn label={labels.up} disabled={i === 0} onClick={() => move(i, -1)}>↑</IconBtn>
                <IconBtn label={labels.down} disabled={i === slides.length - 1} onClick={() => move(i, 1)}>↓</IconBtn>
                <IconBtn label={labels.remove} disabled={slides.length === 1} onClick={() => removeAt(i)}>×</IconBtn>
              </div>
            </div>
            <textarea
              value={s}
              onChange={(e) => setAt(i, e.target.value)}
              rows={mode === "thread" ? 3 : 4}
              className="scb"
              aria-label={`${unit} ${i + 1}`}
              style={{ width: "100%", border: "none", outline: "none", background: "transparent", resize: "vertical", fontSize: 14, color: "var(--slate)", lineHeight: 1.85, fontFamily: "inherit" }}
            />
            <div style={{ textAlign: "end", fontSize: 11, fontWeight: 600, color: over ? "var(--coral)" : "var(--subtle)", fontFamily: "var(--font-latin)" }}>
              {limit > 0 ? `${nf.format(len)} / ${nf.format(limit)}` : nf.format(len)}
              {over ? ` · ${labels.overLimit}` : ""}
            </div>
          </div>
        );
      })}
      <button onClick={add} style={{ height: 40, borderRadius: 11, border: "1.5px dashed var(--border-2)", background: "var(--card)", color: "var(--teal-deep)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        + {labels.add}
      </button>
    </div>
  );
}

function IconBtn({ children, label, disabled, onClick }: { children: React.ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--muted)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, fontSize: 14, lineHeight: 1 }}
    >
      {children}
    </button>
  );
}
