"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { ProgressMeter, btnTeal, btnGhost } from "@/components/ui/display";
import { LESSONS, FAQ } from "@/lib/learn/content";
import { completeLesson } from "./actions";

const cardStyle: CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBlockEnd: 10 };

export function HelpClient({ completed, locale }: { completed: string[]; locale: string }) {
  const t = useTranslations("Help");
  const router = useRouter();
  const isAr = locale === "ar";
  const [tab, setTab] = useState<"learn" | "faq">("learn");
  const [done, setDone] = useState<string[]>(completed);
  const [pending, start] = useTransition();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const mark = (id: string) => {
    setDone((d) => (d.includes(id) ? d : [...d, id]));
    start(async () => { await completeLesson(id); router.refresh(); });
  };
  const pct = Math.round((done.filter((d) => LESSONS.some((l) => l.id === d)).length / LESSONS.length) * 100);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBlockEnd: 16 }}>
        {(["learn", "faq"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "9px 18px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${tab === k ? "var(--teal)" : "var(--border)"}`, background: tab === k ? "var(--teal)" : "transparent", color: tab === k ? "#fff" : "var(--heading)" }}>{t(`tab_${k}`)}</button>
        ))}
      </div>

      {tab === "learn" ? (
        <div>
          <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--heading)" }}>{t("progress", { n: pct })}</div>
              <div style={{ marginBlockStart: 8 }}><ProgressMeter pct={pct} /></div>
            </div>
          </div>
          {LESSONS.map((l) => {
            const c = isAr ? l.ar : l.en;
            const isDone = done.includes(l.id);
            return (
              <div key={l.id} style={cardStyle} className="lift">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: isDone ? "var(--teal)" : "transparent", border: isDone ? "none" : "1.5px solid var(--border-2)" }}>
                    {isDone && <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "var(--heading)" }}>{c.title}</span>
                      <span style={{ fontSize: 11, color: "var(--subtle)" }}>{t("mins", { n: c.mins })}</span>
                    </div>
                    <p style={{ fontSize: 13.5, color: "var(--slate-2)", lineHeight: 1.8, marginBlock: "6px 10px" }}>{c.body}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {l.href && <Link href={l.href} style={{ ...btnGhost, height: 34, fontSize: 12.5 }}>{t("openScreen")} ←</Link>}
                      {!isDone && <button onClick={() => mark(l.id)} disabled={pending} style={{ ...btnTeal, height: 34, fontSize: 12.5 }}>{t("markDone")}</button>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          {FAQ.map((f, i) => {
            const c = isAr ? f.ar : f.en;
            const open = openFaq === i;
            return (
              <div key={i} style={{ ...cardStyle, cursor: "pointer" }} onClick={() => setOpenFaq(open ? null : i)}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--heading)" }}>{c.q}</span>
                  <span style={{ color: "var(--teal)", fontSize: 18, flexShrink: 0 }}>{open ? "−" : "+"}</span>
                </div>
                {open && <p style={{ fontSize: 13.5, color: "var(--slate-2)", lineHeight: 1.85, marginBlockStart: 10 }}>{c.a}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
