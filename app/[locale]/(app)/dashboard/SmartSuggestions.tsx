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
        <div key={s.key} className="lift" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 13, border: "1px solid var(--teal)", background: "var(--teal-tint)", flexWrap: "wrap" }}>
          <span style={{ color: "var(--teal-deep)", fontSize: 15, flexShrink: 0 }}>✦</span>
          <span style={{ flex: 1, minWidth: 160, fontSize: 13.5, fontWeight: 600, color: "var(--heading)" }}>{s.text}</span>
          <Link href={s.href} style={{ height: 32, display: "inline-flex", alignItems: "center", padding: "0 14px", borderRadius: 9, background: "var(--navy,#273343)", color: "#fff", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
            {s.cta}
          </Link>
          <button onClick={() => dismiss(s.key)} aria-label="dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--teal-deep)", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>
        </div>
      ))}
    </div>
  );
}
