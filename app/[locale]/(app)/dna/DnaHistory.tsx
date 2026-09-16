"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { btnGhost } from "@/components/ui/display";
import { revertDnaVersion } from "./actions";

/** One version, with every number already formatted. The server owns the
 * locale, the calendar and the ICU interpolation, so nothing here can render
 * differently on the client than it did on the server. */
export type DnaVersionRow = {
  id: string;
  version: number;
  current: boolean;
  /** e.g. "12 Sep 2026 · 84% complete" */
  meta: string;
  /** e.g. "Learned from 6 of your real posts" — or the "sources only" wording. */
  learnedLabel: string;
  /** The published posts whose real performance informed this version. */
  learnedFrom: { hook: string; engagementLabel: string }[];
};

export type HistoryLabels = {
  title: string;
  sub: string;
  current: string;
  revert: string;
  reverting: string;
  error: string;
  provenTitle: string;
};

/**
 * Version history, and the one control that makes the learning loop safe to
 * ship: a revert.
 *
 * Real performance now feeds back into the voice model, which means the product
 * changes how the customer sounds without being asked. That is only acceptable
 * if they can see exactly what a version learned from and reject it in one
 * click — so this shows the actual posts behind the change, by their own hooks,
 * rather than a claim that "your DNA improved".
 */
export function DnaHistory({ versions, labels }: { versions: DnaVersionRow[]; labels: HistoryLabels }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  if (!versions.length) return null;

  const revert = (id: string) =>
    start(async () => {
      setErr("");
      setBusy(id);
      const r = await revertDnaVersion(id);
      setBusy(null);
      if (!r.ok) { setErr(labels.error); return; }
      router.refresh();
    });

  const current = versions.find((v) => v.current);

  return (
    <section style={{ marginBlockStart: 20, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 15 }}>{labels.title}</div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBlock: "6px 16px", lineHeight: 1.85 }}>{labels.sub}</p>

      {/* What the CURRENT version learned from, named post by post. */}
      {current && current.learnedFrom.length > 0 && (
        <div style={{ background: "var(--teal-tint-2)", border: "1px solid rgba(15,118,110,.25)", borderRadius: 13, padding: "14px 16px", marginBlockEnd: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--teal-deep)" }}>{labels.provenTitle}</div>
          <div style={{ display: "grid", gap: 8, marginBlockStart: 10 }}>
            {current.learnedFrom.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13.5, color: "var(--slate)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.hook}</span>
                <span style={{ flex: "none", fontSize: 12, fontWeight: 700, color: "var(--teal-deep)" }}>{p.engagementLabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {versions.map((v) => (
          <div
            key={v.id}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
              padding: "12px 14px", borderRadius: 12,
              background: v.current ? "var(--surface)" : "transparent",
              border: `1px solid ${v.current ? "var(--border-2)" : "var(--border)"}`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--heading)", fontFamily: "var(--font-latin)" }}>v{v.version}</span>
                {v.current && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "var(--teal-tint-2)", color: "var(--teal-deep)" }}>
                    {labels.current}
                  </span>
                )}
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{v.meta}</span>
              </div>
              <div style={{ fontSize: 12.5, color: v.learnedFrom.length ? "var(--teal-deep)" : "var(--muted)", marginBlockStart: 5 }}>
                {v.learnedLabel}
              </div>
            </div>
            {!v.current && (
              <button
                onClick={() => revert(v.id)}
                disabled={pending}
                style={{ ...btnGhost, height: 36, fontSize: 13, opacity: pending ? 0.6 : 1, cursor: pending ? "default" : "pointer" }}
              >
                {busy === v.id ? labels.reverting : labels.revert}
              </button>
            )}
          </div>
        ))}
      </div>

      {err && <div style={{ marginBlockStart: 12, fontSize: 13, color: "var(--coral)" }}>{err}</div>}
    </section>
  );
}
