"use client";

import { useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { dismissSuggestion } from "../plan/actions";

export type Suggestion = { key: string; text: string; cta: string; href: string };

/** Context-aware, dismissible next-best-action tips (Phase 2 #19). Derived from
 * real state server-side; dismissals persist per brand so a tip stays hidden. */
export function SmartSuggestions({ items }: { items: Suggestion[] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [, start] = useTransition();
  const visible = items.filter((s) => !hidden.includes(s.key));
  if (!visible.length) return null;

  const dismiss = (key: string) => {
    setHidden((h) => [...h, key]);
    start(async () => { await dismissSuggestion(key); });
  };

  return (
    <div className="stagger" style={{ display: "grid", gap: 8, marginBlockStart: 20 }}>
      {visible.map((s) => (
        <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", flexWrap: "wrap" }}>
          <span aria-hidden style={{ flexShrink: 0, color: "var(--teal-deep)", display: "grid", placeItems: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c.7.7 1 1.3 1 2h6c0-.7.3-1.3 1-2a6 6 0 0 0-4-10z" /></svg>
          </span>
          <span style={{ flex: 1, minWidth: 160, fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{s.text}</span>
          <Link href={s.href} style={{ height: 32, display: "inline-flex", alignItems: "center", padding: "0 14px", borderRadius: 8, background: "var(--teal)", color: "#fff", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
            {s.cta}
          </Link>
          <button onClick={() => dismiss(s.key)} aria-label="dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>
        </div>
      ))}
    </div>
  );
}
