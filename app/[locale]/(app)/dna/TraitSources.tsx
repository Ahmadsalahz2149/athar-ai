"use client";

import { useState, useTransition } from "react";
import { traitProvenance, type TraitItem } from "./actions";

type Labels = {
  title: string; subtitle: string; load: string; loading: string;
  cat: Record<string, string>; closest: string; weak: string; none: string;
  noKey: string; noSources: string; empty: string;
};

/** On-demand "where did each trait come from?" panel (source-of-each-trait). */
export function TraitSources({ labels }: { labels: Labels }) {
  const [pending, start] = useTransition();
  const [items, setItems] = useState<TraitItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = () => start(async () => {
    setErr(null);
    const r = await traitProvenance();
    setLoaded(true);
    if (!r.ok) {
      setErr(r.reason === "no_key" ? labels.noKey : r.reason === "no_sources" ? labels.noSources : labels.empty);
      setItems(null);
      return;
    }
    setItems(r.items);
  });

  return (
    <section style={{ marginBlockStart: 20, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 15 }}>{labels.title}</div>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBlockStart: 6 }}>{labels.subtitle}</p>
        </div>
        {!loaded && (
          <button onClick={load} disabled={pending} style={{ height: 40, padding: "0 18px", borderRadius: 11, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--teal-deep)", fontWeight: 600, fontSize: 13, cursor: pending ? "default" : "pointer" }}>
            {pending ? labels.loading : `✦ ${labels.load}`}
          </button>
        )}
      </div>

      {err && <p style={{ marginBlockStart: 14, fontSize: 13, color: "var(--muted)" }}>{err}</p>}

      {items && items.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginBlockStart: 16 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 13px", borderRadius: 11, background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span style={{ flex: "none", fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "var(--border-3)", color: "var(--slate-2)", marginBlockStart: 2 }}>{labels.cat[it.category] ?? it.category}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--heading)" }}>{it.trait}</div>
                {it.sourceId ? (
                  <div style={{ marginBlockStart: 4, fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                    <span style={{ color: it.strong ? "var(--teal-deep)" : "var(--gold-dark)", fontWeight: 600 }}>
                      {it.strong ? labels.closest : labels.weak}:
                    </span>{" "}
                    <b style={{ color: "var(--slate)" }}>{it.sourceTitle || "—"}</b>
                    {it.snippet && <span style={{ color: "var(--subtle)" }}> · “{it.snippet}…”</span>}
                  </div>
                ) : (
                  <div style={{ marginBlockStart: 4, fontSize: 12, color: "var(--subtle)" }}>{labels.none}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
