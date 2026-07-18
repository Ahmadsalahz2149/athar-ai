"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setDraftStatus, approveAll } from "./actions";
import { PlatformBadge, StatusPill, EmptyState, btnTeal, btnGhost } from "@/components/ui/display";

type Draft = {
  id: string;
  hook: string;
  body: string;
  platform: string;
  status: string;
  postScore: number;
  dnaMatch: number;
  scheduledAt: string | null;
};

const TABS = ["pending", "approved", "needs_edit"] as const;

export function ApprovalsClient({ drafts }: { drafts: Draft[] }) {
  const t = useTranslations("Approvals");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const dtf = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { weekday: "long", day: "numeric", month: "long" });
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  const pendingCount = drafts.filter((d) => d.status === "pending").length;
  const shown = drafts.filter((d) => (tab === "approved" ? d.status === "approved" || d.status === "scheduled" : d.status === tab));

  return (
    <div>
      {pendingCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "16px 20px", borderRadius: 16, background: "linear-gradient(160deg,#102A43,#0B1F33)", color: "#fff", marginBlockEnd: 18 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            <b style={{ color: "var(--teal-light)", fontFamily: "var(--font-latin)" }}>{nf.format(pendingCount)}</b> {t("bannerText")}
          </span>
          <button onClick={() => act(approveAll)} disabled={pending} style={{ ...btnTeal, height: 40 }}>{t("approveAll")}</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBlockEnd: 18 }}>
        {TABS.map((f) => (
          <button key={f} onClick={() => setTab(f)} style={{ padding: "8px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: "pointer", border: tab === f ? "1.5px solid var(--navy)" : "1.5px solid var(--border-2)", background: tab === f ? "var(--navy)" : "var(--card)", color: tab === f ? "#fff" : "var(--slate)" }}>
            {t(`tab_${f}`)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {shown.map((d) => (
            <div key={d.id} className="approval-card" style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 0, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
              {/* content pane */}
              <div style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 10 }}>
                  <PlatformBadge platform={d.platform} size={30} />
                  <span style={{ fontWeight: 700, color: "var(--heading)", fontSize: 14.5 }}>{d.platform} · {truncate(d.hook, 26)}</span>
                </div>
                {d.scheduledAt && <div style={{ fontSize: 12, color: "var(--muted)", marginBlockEnd: 10 }}>{dtf.format(new Date(d.scheduledAt))}</div>}
                <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.85, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap" }}>
                  {d.hook}
                  {"\n"}
                  {d.body}
                </p>
              </div>

              {/* action rail */}
              <div style={{ borderInlineStart: "1px solid var(--border)", background: "var(--surface)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
                  <ScoreCell value={`${nf.format(d.dnaMatch)}%`} label={t("dnaMatch")} />
                  <div style={{ width: 1, background: "var(--border-2)" }} />
                  <ScoreCell value={nf.format(d.postScore)} label="Post Score" />
                </div>
                {d.status === "pending" ? (
                  <div style={{ display: "grid", gap: 8, marginBlockStart: "auto" }}>
                    <button onClick={() => act(() => setDraftStatus(d.id, "scheduled", true))} disabled={pending} style={{ ...btnTeal, width: "100%", height: 40, fontSize: 13 }}>{t("approve")}</button>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => act(() => setDraftStatus(d.id, "needs_edit"))} disabled={pending} style={{ ...btnGhost, flex: 1, height: 36, fontSize: 12.5 }}>{t("edit")}</button>
                      <button onClick={() => act(() => setDraftStatus(d.id, "needs_edit"))} disabled={pending} style={{ ...btnGhost, flex: 1, height: 36, fontSize: 12.5, color: "var(--coral)", borderColor: "rgba(224,101,74,.3)" }}>{t("reject")}</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBlockStart: "auto", textAlign: "center" }}>
                    <StatusPill tone={d.status === "needs_edit" ? "red" : "teal"}>{t(`st_${d.status}`)}</StatusPill>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreCell({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginBlockStart: 2 }}>{label}</div>
    </div>
  );
}
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
