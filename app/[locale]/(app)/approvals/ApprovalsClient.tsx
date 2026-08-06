"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { setDraftStatus, approveAll, reviewDraft } from "./actions";
import { PlatformBadge, EmptyState, btnTeal, btnGhost, btnNavy } from "@/components/ui/display";

type Draft = {
  id: string;
  hook: string;
  body: string;
  platform: string;
  status: string;
  postScore: number;
  dnaMatch: number;
  scheduledAt: string | null;
  reviewNote: string | null;
};

const TABS = ["pending", "approved", "needs_edit", "rejected"] as const;

export function ApprovalsClient({ drafts }: { drafts: Draft[] }) {
  const t = useTranslations("Approvals");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const dtf = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { weekday: "long", day: "numeric", month: "long" });
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmAll, setConfirmAll] = useState(false);
  const [noteFor, setNoteFor] = useState<{ id: string; mode: "needs_edit" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  const act = (fn: () => Promise<unknown>, msg: string) =>
    start(async () => {
      await fn();
      setToast(msg);
      setTimeout(() => setToast(null), 2200);
      router.refresh();
    });

  const pendingList = drafts.filter((d) => d.status === "pending");
  const shown = drafts.filter((d) => (tab === "approved" ? d.status === "approved" || d.status === "scheduled" : d.status === tab));
  const selCount = Object.values(selected).filter(Boolean).length;

  const bulkApprove = () =>
    act(async () => {
      for (const id of Object.keys(selected).filter((k) => selected[k])) await setDraftStatus(id, "scheduled", true);
      setSelected({});
    }, t("bulkApproved", { n: nf.format(selCount) }));

  return (
    <div>
      {toast && (
        <div role="status" style={{ position: "fixed", insetBlockEnd: 22, insetInlineStart: "50%", transform: "translateX(-50%)", zIndex: 60, padding: "10px 18px", borderRadius: 999, background: "var(--navy)", color: "#fff", fontSize: 13.5, fontWeight: 600, boxShadow: "0 12px 30px -10px rgba(11,31,51,.5)" }}>
          {toast}
        </div>
      )}

      {pendingList.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "16px 20px", borderRadius: 16, background: "linear-gradient(160deg,#273343,#1F2937)", color: "#fff", marginBlockEnd: 18 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            <b style={{ color: "var(--teal-light)", fontFamily: "var(--font-latin)" }}>{nf.format(pendingList.length)}</b> {t("bannerText")}
          </span>
          <button onClick={() => setConfirmAll(true)} disabled={pending} style={{ ...btnTeal, height: 40 }}>{t("approveAll")}</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBlockEnd: 18, flexWrap: "wrap", alignItems: "center" }}>
        {TABS.map((f) => {
          const n = drafts.filter((d) => (f === "approved" ? d.status === "approved" || d.status === "scheduled" : d.status === f)).length;
          return (
            <button key={f} onClick={() => setTab(f)} aria-pressed={tab === f} style={{ padding: "8px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: "pointer", border: tab === f ? "1.5px solid var(--navy)" : "1.5px solid var(--border-2)", background: tab === f ? "var(--navy)" : "var(--card)", color: tab === f ? "#fff" : "var(--slate)" }}>
              {t(`tab_${f}`)} {n > 0 && <span style={{ fontFamily: "var(--font-latin)", opacity: 0.7 }}>{nf.format(n)}</span>}
            </button>
          );
        })}
        {tab === "pending" && selCount > 0 && (
          <button onClick={bulkApprove} disabled={pending} style={{ ...btnTeal, height: 34, marginInlineStart: "auto", fontSize: 12.5 }}>{t("approveSelected", { n: nf.format(selCount) })}</button>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {shown.map((d) => {
            const isExp = expanded[d.id];
            return (
              <div key={d.id} className="approval-card" style={{ display: "grid", gridTemplateColumns: "1fr 210px", background: "var(--card)", border: selected[d.id] ? "1.5px solid var(--teal)" : "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                <div style={{ padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 10 }}>
                    {d.status === "pending" && (
                      <input type="checkbox" checked={!!selected[d.id]} onChange={(e) => setSelected((s) => ({ ...s, [d.id]: e.target.checked }))} aria-label={t("select")} style={{ width: 17, height: 17, accentColor: "var(--teal)" }} />
                    )}
                    <PlatformBadge platform={d.platform} size={30} />
                    <span style={{ fontWeight: 700, color: "var(--heading)", fontSize: 14.5 }}>{d.platform} · {truncate(d.hook, 26)}</span>
                  </div>
                  {d.scheduledAt && <div style={{ fontSize: 12, color: "var(--muted)", marginBlockEnd: 10 }}>{dtf.format(new Date(d.scheduledAt))}</div>}
                  <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.85, whiteSpace: "pre-wrap", ...(isExp ? {} : { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>
                    {d.hook}{"\n"}{d.body}
                  </p>
                  <button onClick={() => setExpanded((s) => ({ ...s, [d.id]: !isExp }))} style={{ background: "none", border: "none", color: "var(--teal-deep)", fontWeight: 600, fontSize: 12.5, cursor: "pointer", marginBlockStart: 6, padding: 0 }}>
                    {isExp ? t("showLess") : t("showFull")}
                  </button>
                  {d.reviewNote && (
                    <div style={{ marginBlockStart: 10, padding: "9px 12px", borderRadius: 10, background: "var(--coral-tint)", fontSize: 12.5, color: "var(--coral)" }}>
                      <b>{t("reviewerNote")}:</b> {d.reviewNote}
                    </div>
                  )}
                </div>

                <div style={{ borderInlineStart: "1px solid var(--border)", background: "var(--surface)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
                    <ScoreCell value={`${nf.format(d.dnaMatch)}%`} label={t("dnaMatch")} />
                    <div style={{ width: 1, background: "var(--border-2)" }} />
                    <ScoreCell value={nf.format(d.postScore)} label="Post Score" />
                  </div>
                  {d.status === "pending" ? (
                    <div style={{ display: "grid", gap: 8, marginBlockStart: "auto" }}>
                      <button onClick={() => act(() => setDraftStatus(d.id, "scheduled", true), t("approvedOne"))} disabled={pending} style={{ ...btnTeal, width: "100%", height: 40, fontSize: 13 }}>{t("approve")}</button>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setNoteFor({ id: d.id, mode: "needs_edit" }); setNote(""); }} disabled={pending} style={{ ...btnGhost, flex: 1, height: 36, fontSize: 12.5 }}>{t("edit")}</button>
                        <button onClick={() => { setNoteFor({ id: d.id, mode: "rejected" }); setNote(""); }} disabled={pending} style={{ ...btnGhost, flex: 1, height: 36, fontSize: 12.5, color: "var(--coral)", borderColor: "rgba(224,101,74,.3)" }}>{t("reject")}</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginBlockStart: "auto", textAlign: "center" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, background: d.status === "rejected" || d.status === "needs_edit" ? "var(--coral-tint)" : "var(--teal-tint-2)", color: d.status === "rejected" || d.status === "needs_edit" ? "var(--coral)" : "var(--teal-deep)" }}>{t(`st_${d.status}`)}</span>
                    </div>
                  )}
                  {/* Bridge to the Media Studio — turn this post into a voice-over / image / video. */}
                  <Link href={`/media?draft=${d.id}&kind=image`} style={{ ...btnGhost, height: 32, fontSize: 12, marginBlockStart: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>🎬 {t("createMedia")}</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approve-all confirmation */}
      {confirmAll && (
        <Modal onClose={() => setConfirmAll(false)}>
          <div style={{ fontWeight: 700, fontSize: 17, color: "var(--heading)", marginBlockEnd: 8 }}>{t("confirmAllTitle")}</div>
          <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.7, marginBlockEnd: 18 }}>{t("confirmAllBody", { n: nf.format(pendingList.length) })}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setConfirmAll(false)} style={{ ...btnGhost, height: 40 }}>{t("cancel")}</button>
            <button onClick={() => { setConfirmAll(false); act(approveAll, t("approvedAll")); }} style={{ ...btnTeal, height: 40 }}>{t("approveAll")}</button>
          </div>
        </Modal>
      )}

      {/* Reviewer-note modal (edit / reject) */}
      {noteFor && (
        <Modal onClose={() => setNoteFor(null)}>
          <div style={{ fontWeight: 700, fontSize: 17, color: "var(--heading)", marginBlockEnd: 8 }}>{t(noteFor.mode === "rejected" ? "rejectTitle" : "editTitle")}</div>
          <p style={{ fontSize: 13.5, color: "var(--muted)", marginBlockEnd: 12 }}>{t("noteHelper")}</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder={t("notePh")} className="scb" style={{ width: "100%", padding: 12, borderRadius: 11, border: "1px solid var(--border-2)", fontSize: 14, lineHeight: 1.7, resize: "vertical", outline: "none" }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginBlockStart: 16 }}>
            <button onClick={() => setNoteFor(null)} style={{ ...btnGhost, height: 40 }}>{t("cancel")}</button>
            <button onClick={() => { const nf2 = noteFor; setNoteFor(null); act(() => reviewDraft(nf2.id, nf2.mode, note), t(nf2.mode === "rejected" ? "rejectedOne" : "sentBack")); }} style={{ ...btnNavy, height: 40, background: noteFor.mode === "rejected" ? "var(--coral)" : undefined }}>{t("confirm")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(8,24,38,.5)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "var(--card)", borderRadius: 18, padding: 24, boxShadow: "0 24px 60px -18px rgba(11,31,51,.5)" }}>
        {children}
      </div>
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
