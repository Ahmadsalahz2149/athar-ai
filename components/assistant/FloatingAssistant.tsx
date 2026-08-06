"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { askAssistant, loadAssistantHistory, clearAssistantHistory, type ChatMsg } from "./actions";

export function FloatingAssistant() {
  const t = useTranslations("Assistant");
  const [open, setOpen] = useState(false);
  const loadedRef = useRef(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load persisted history once, the first time the panel opens. setMsgs runs
    // inside the async callback (not synchronously in the effect body).
    if (open && !loadedRef.current) {
      loadedRef.current = true;
      loadAssistantHistory().then((h) => setMsgs(h)).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open, pending]);

  const send = () => {
    const m = text.trim();
    if (!m || pending) return;
    setErr("");
    setText("");
    const history = msgs;
    setMsgs((p) => [...p, { role: "user", content: m }]);
    start(async () => {
      const r = await askAssistant(m, history);
      if (r.ok) setMsgs((p) => [...p, { role: "assistant", content: r.reply }]);
      else {
        setErr(r.error === "insufficient_credits" ? t("errCredits") : r.error === "no_key" ? t("errNoKey") : t("errGeneric"));
        setMsgs((p) => p.slice(0, -1)); // roll back the optimistic user msg
        setText(m);
      }
    });
  };

  const clear = () => start(async () => { await clearAssistantHistory(); setMsgs([]); });

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("open")}
        style={{
          position: "fixed", insetBlockEnd: 20, insetInlineEnd: 20, zIndex: 60,
          width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer",
          background: "linear-gradient(160deg,var(--teal),var(--teal-deep,#0f766e))", color: "#fff",
          boxShadow: "0 8px 24px rgba(20,184,166,.4)", display: "grid", placeItems: "center", fontSize: 22,
        }}
        className="lift"
      >
        {open ? "×" : "✦"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("title")}
          style={{
            position: "fixed", insetBlockEnd: 88, insetInlineEnd: 20, zIndex: 60,
            width: "min(calc(100vw - 40px), 380px)", height: "min(70vh, 560px)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            background: "var(--surface,#fff)", border: "1px solid var(--border)", borderRadius: 18,
            boxShadow: "0 16px 48px rgba(11,31,51,.24)", animation: "floatUp .25s ease",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "linear-gradient(160deg,#102A43,#0B1F33)", color: "#fff" }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: "rgba(20,184,166,.25)", color: "var(--teal-light)" }}>✦</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t("title")}</div>
              <div style={{ fontSize: 11, color: "#9FB3C8" }}>{t("subtitle")}</div>
            </div>
            {msgs.length > 0 && <button onClick={clear} disabled={pending} style={{ background: "none", border: "none", color: "#9FB3C8", cursor: "pointer", fontSize: 11.5 }}>{t("clear")}</button>}
            <button onClick={() => setOpen(false)} aria-label={t("close")} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="scb" style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10, background: "var(--bg,#f8fafc)" }}>
            {msgs.length === 0 && !pending && (
              <div style={{ margin: "auto", textAlign: "center", color: "var(--muted)", fontSize: 13, lineHeight: 1.8, padding: 12 }}>
                <div style={{ fontSize: 26, marginBlockEnd: 8 }}>✦</div>
                {t("empty")}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", padding: "9px 12px", borderRadius: 13, fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap", background: m.role === "user" ? "var(--teal)" : "var(--card,#fff)", color: m.role === "user" ? "#fff" : "var(--heading)", border: m.role === "user" ? "none" : "1px solid var(--border)" }}>
                {m.content}
              </div>
            ))}
            {pending && <div style={{ alignSelf: "flex-start", padding: "9px 12px", borderRadius: 13, background: "var(--card,#fff)", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 13 }}>{t("thinking")}</div>}
          </div>

          {err && <div style={{ padding: "6px 14px", fontSize: 12, color: "var(--danger,#dc2626)", background: "var(--bg,#f8fafc)" }}>{err}</div>}

          {/* Input */}
          <div style={{ display: "flex", gap: 8, padding: 10, borderBlockStart: "1px solid var(--border)", background: "var(--surface,#fff)" }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder={t("placeholder")}
              style={{ flex: 1, height: 40, padding: "0 12px", borderRadius: 11, border: "1px solid var(--border)", background: "var(--bg,#fff)", fontSize: 13.5, color: "var(--heading)", outline: "none", fontFamily: "inherit" }}
            />
            <button onClick={send} disabled={pending || !text.trim()} aria-label={t("send")} style={{ width: 40, height: 40, borderRadius: 11, border: "none", cursor: "pointer", background: "var(--teal)", color: "#fff", fontSize: 16, opacity: pending || !text.trim() ? 0.6 : 1 }}>➤</button>
          </div>
        </div>
      )}
    </>
  );
}
