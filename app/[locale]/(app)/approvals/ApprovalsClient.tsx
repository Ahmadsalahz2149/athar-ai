"use client";
/* eslint-disable @next/next/no-img-element -- generated media thumbnails, not next/image-optimizable */

import { Fragment, useState, useTransition } from "react";
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

type Asset = { id: string; kind: string; url: string };

export function ApprovalsClient({ drafts, media = {} }: { drafts: Draft[]; media?: Record<string, Asset[]> }) {
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "16px 20px", borderRadius: 16, background: "linear-gradient(160deg,var(--navy-2),var(--navy))", color: "#fff", marginBlockEnd: 18 }}>
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
            <button key={f} onClick={() => setTab(f)} aria-pressed={tab === f} style={{ padding: "8px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: "pointer", border: tab === f ? "1.5px solid var(--navy)" : "1.5px solid var(--border-2)", background: tab === f ? "var(--teal)" : "var(--card)", color: tab === f ? "#fff" : "var(--slate)" }}>
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
        <div className="dtable-wrap">
          <div className="dtable-scroll">
            <table className="dtable">
              <thead>
                <tr>
                  {tab === "pending" && <th style={{ width: 40 }}><span className="sr-only">{t("select")}</span></th>}
                  <th>{t("colPost")}</th>
                  <th style={{ width: 84 }} className="dt-num">{t("dnaMatch")}</th>
                  <th style={{ width: 84 }} className="dt-num">Post Score</th>
                  <th style={{ width: 116 }}>{t("colStatus")}</th>
                  <th style={{ width: tab === "pending" ? 150 : 96 }}>{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => {
                  const isExp = expanded[d.id];
                  const cols = tab === "pending" ? 6 : 5;
                  const mediaCount = media[d.id]?.length ?? 0;
                  return (
                    <Fragment key={d.id}>
                      <tr className={selected[d.id] ? "is-selected" : undefined}>
                        {tab === "pending" && (
                          <td>
                            <input type="checkbox" checked={!!selected[d.id]} onChange={(e) => setSelected((s) => ({ ...s, [d.id]: e.target.checked }))} aria-label={t("select")} style={{ width: 16, height: 16, accentColor: "var(--teal)", display: "block" }} />
                          </td>
                        )}
                        <td style={{ maxWidth: 420 }}>
                          <button onClick={() => setExpanded((s) => ({ ...s, [d.id]: !isExp }))} aria-expanded={isExp} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "start", width: "100%", minWidth: 0 }}>
                            <PlatformBadge platform={d.platform} size={28} />
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span className="dt-title" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.hook || truncate(d.body, 40)}</span>
                              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--muted)", marginBlockStart: 2 }}>
                                <span>{d.platform}</span>
                                {d.scheduledAt && <span>· {dtf.format(new Date(d.scheduledAt))}</span>}
                                {mediaCount > 0 && <span>· {t("attachedMedia", { n: mediaCount })}</span>}
                              </span>
                            </span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--subtle)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: isExp ? "rotate(180deg)" : "none", transition: "transform .15s" }}><path d="M6 9l6 6 6-6" /></svg>
                          </button>
                        </td>
                        <td className="dt-num" style={{ fontWeight: 700, color: "var(--teal-deep)" }}>{nf.format(d.dnaMatch)}%</td>
                        <td className="dt-num" style={{ fontWeight: 700, color: "var(--heading)" }}>{nf.format(d.postScore)}</td>
                        <td>
                          <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, whiteSpace: "nowrap", background: d.status === "rejected" || d.status === "needs_edit" ? "var(--coral-tint)" : d.status === "pending" ? "var(--gold-tint)" : "var(--teal-tint-2)", color: d.status === "rejected" || d.status === "needs_edit" ? "var(--coral)" : d.status === "pending" ? "var(--gold-dark)" : "var(--teal-deep)" }}>
                            {d.status === "pending" ? t("tab_pending") : t(`st_${d.status}`)}
                          </span>
                        </td>
                        <td>
                          {d.status === "pending" ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => act(() => setDraftStatus(d.id, "scheduled", true), t("approvedOne"))} disabled={pending} title={t("approve")} aria-label={t("approve")} className="dt-iconbtn" style={{ color: "var(--teal-deep)", borderColor: "var(--teal)" }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                              </button>
                              <button onClick={() => { setNoteFor({ id: d.id, mode: "needs_edit" }); setNote(""); }} disabled={pending} title={t("edit")} aria-label={t("edit")} className="dt-iconbtn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L18 10l-4-4L4 16zM14 6l4 4" /></svg>
                              </button>
                              <button onClick={() => { setNoteFor({ id: d.id, mode: "rejected" }); setNote(""); }} disabled={pending} title={t("reject")} aria-label={t("reject")} className="dt-iconbtn" style={{ color: "var(--coral)" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                              </button>
                            </div>
                          ) : (
                            <Link href={`/media?draft=${d.id}&kind=image`} title={t("createMedia")} aria-label={t("createMedia")} className="dt-iconbtn">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM10 9l5 3-5 3z" /></svg>
                            </Link>
                          )}
                        </td>
                      </tr>
                      {isExp && (
                        <tr className="dt-detail">
                          <td colSpan={cols} style={{ background: "var(--surface)" }}>
                            <div style={{ padding: "4px 6px 8px" }}>
                              <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.85, whiteSpace: "pre-wrap", margin: 0 }}>{d.hook}{"\n"}{d.body}</p>
                              {d.reviewNote && (
                                <div style={{ marginBlockStart: 10, padding: "9px 12px", borderRadius: 10, background: "var(--coral-tint)", fontSize: 12.5, color: "var(--coral)" }}>
                                  <b>{t("reviewerNote")}:</b> {d.reviewNote}
                                </div>
                              )}
                              {mediaCount > 0 && (
                                <div style={{ marginBlockStart: 12 }}>
                                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--teal-deep)", marginBlockEnd: 6 }}>{t("attachedMedia", { n: mediaCount })}</div>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {media[d.id].map((a) => (
                                      <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: 60, height: 60, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg)", flexShrink: 0 }}>
                                        {a.kind === "image" && <img src={a.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                                        {a.kind === "video" && <video src={a.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />}
                                        {a.kind === "voice" && <span style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", color: "var(--muted)" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg></span>}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div style={{ marginBlockStart: 12 }}>
                                <Link href={`/media?draft=${d.id}&kind=image`} style={{ ...btnGhost, height: 32, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>{t("createMedia")}</Link>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
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
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
