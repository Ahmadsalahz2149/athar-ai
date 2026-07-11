"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setDraftStatus, approveAll } from "./actions";

type Draft = { id: string; hook: string; body: string; platform: string; status: string; postScore: number; dnaMatch: number };

export function ApprovalsClient({ drafts }: { drafts: Draft[] }) {
  const t = useTranslations("Approvals");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "approved" | "scheduled">("pending");
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<unknown>) => start(async () => {
    await fn();
    router.refresh();
  });

  const shown = drafts.filter((d) => (tab === "approved" ? d.status === "approved" : d.status === tab));
  const pendingCount = drafts.filter((d) => d.status === "pending").length;

  return (
    <div>
      {pendingCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderRadius: 14, background: "var(--gold-tint)", border: "1px solid rgba(214,168,79,.35)", marginBlockEnd: 16 }}>
          <span style={{ fontWeight: 600, color: "var(--gold-dark)" }}>{t("pendingBanner", { n: nf.format(pendingCount) })}</span>
          <button onClick={() => act(approveAll)} disabled={pending} style={{ height: 38, padding: "0 18px", borderRadius: 10, border: "none", background: "var(--teal)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>{t("approveAll")}</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBlockEnd: 16 }}>
        {(["pending", "approved", "scheduled"] as const).map((f) => (
          <button key={f} onClick={() => setTab(f)} style={{ padding: "7px 15px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: tab === f ? "1.5px solid var(--teal)" : "1.5px solid var(--border-2)", background: tab === f ? "var(--teal-tint-2)" : "var(--card)", color: tab === f ? "var(--navy)" : "var(--slate)" }}>
            {t(`tab_${f}`)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", border: "1px dashed var(--border-2)", borderRadius: 16, background: "var(--surface)", color: "var(--muted)" }}>{t("empty")}</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {shown.map((d) => (
            <div key={d.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBlockEnd: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "var(--blue-tint)", color: "var(--blue)" }}>{d.platform}</span>
                <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-latin)" }}>Score {nf.format(d.postScore)} · DNA {nf.format(d.dnaMatch)}</span>
              </div>
              <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockEnd: 6 }}>{d.hook}</div>
              <div style={{ whiteSpace: "pre-wrap", color: "var(--slate)", fontSize: 14, lineHeight: 1.8, maxHeight: 120, overflow: "hidden" }}>{d.body}</div>
              {d.status === "pending" && (
                <div style={{ display: "flex", gap: 10, marginBlockStart: 14, flexWrap: "wrap" }}>
                  <button onClick={() => act(() => setDraftStatus(d.id, "scheduled", true))} disabled={pending} style={btn("var(--teal)", "#fff")}>{t("approve")}</button>
                  <button onClick={() => act(() => setDraftStatus(d.id, "needs_edit"))} disabled={pending} style={btn("var(--card)", "var(--coral)", "var(--coral)")}>{t("reject")}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function btn(bg: string, color: string, border?: string): React.CSSProperties {
  return { height: 40, padding: "0 20px", borderRadius: 10, border: border ? `1px solid ${border}` : "none", background: bg, color, fontWeight: 700, cursor: "pointer", fontSize: 13 };
}
