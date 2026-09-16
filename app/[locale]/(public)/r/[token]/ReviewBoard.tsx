"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ReviewPost } from "@/lib/review/publicReview";
import { decide } from "./actions";

/**
 * The client's view of a month of posts.
 *
 * Built for someone who has never seen this product and will use it for ten
 * minutes: no navigation, no jargon, two buttons. The note box only appears
 * once they ask for a change, because a field that is usually left empty reads
 * as homework.
 */
export function ReviewBoard({ token, posts: initial }: { token: string; posts: ReviewPost[] }) {
  const t = useTranslations("Review");
  const [posts, setPosts] = useState(initial);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const waiting = useMemo(() => posts.filter((p) => p.status === "pending").length, [posts]);

  const answer = (id: string, decision: "approved" | "needs_edit", text?: string) =>
    start(async () => {
      setErr("");
      setBusy(id);
      const r = await decide(token, id, decision, text);
      setBusy(null);
      if (!r.ok) { setErr(t(`err_${r.error}`)); return; }
      // Reflect the answer immediately. Re-fetching the whole board would blank
      // the screen for a second and lose the person's place in a long list.
      setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, status: decision, reviewNote: text?.trim() ? text.trim() : p.reviewNote } : p)));
      setOpenNote(null);
      setNote("");
    });

  if (!posts.length) {
    return <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.9 }}>{t("empty")}</p>;
  }

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBlockEnd: 18 }}>
        {waiting > 0 ? t("waiting", { n: waiting }) : t("allAnswered")}
      </p>

      <div style={{ display: "grid", gap: 14 }}>
        {posts.map((p) => {
          const answered = p.status === "approved" || p.status === "scheduled";
          const changes = p.status === "needs_edit";
          return (
            <article
              key={p.id}
              style={{
                background: "var(--card)",
                border: `1px solid ${answered ? "rgba(15,118,110,.35)" : changes ? "rgba(214,168,79,.45)" : "var(--border)"}`,
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBlockEnd: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border-2)", color: "var(--slate)" }}>
                  {p.platform}
                </span>
                {answered && <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "var(--teal-tint-2)", color: "var(--teal-deep)" }}>{t("stateApproved")}</span>}
                {changes && <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "var(--gold-tint)", color: "var(--gold-dark)" }}>{t("stateChanges")}</span>}
              </div>

              <h2 style={{ fontSize: 16.5, fontWeight: 700, color: "var(--heading)", lineHeight: 1.7, margin: 0 }}>{p.hook}</h2>
              <p style={{ fontSize: 14.5, color: "var(--slate)", lineHeight: 1.95, whiteSpace: "pre-wrap", marginBlock: "10px 0" }}>{p.body}</p>

              {p.media.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBlockStart: 12 }}>
                  {p.media.filter((m) => m.kind === "image").map((m) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.id} src={m.url} alt="" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} />
                  ))}
                </div>
              )}

              {p.reviewNote && (
                <p style={{ marginBlockStart: 12, padding: "10px 13px", borderRadius: 11, background: "var(--gold-tint)", fontSize: 13.5, color: "var(--slate)", lineHeight: 1.8 }}>
                  {t("yourNote")}: {p.reviewNote}
                </p>
              )}

              {openNote === p.id ? (
                <div style={{ marginBlockStart: 14 }}>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={600}
                    placeholder={t("notePlaceholder")}
                    style={{ width: "100%", borderRadius: 11, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--heading)", padding: "10px 12px", fontSize: 14, lineHeight: 1.8, fontFamily: "inherit" }}
                  />
                  <div style={{ display: "flex", gap: 8, marginBlockStart: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => answer(p.id, "needs_edit", note)}
                      disabled={pending || !note.trim()}
                      style={{ height: 38, paddingInline: 16, borderRadius: 10, border: "none", background: "var(--gold-dark)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: pending || !note.trim() ? 0.6 : 1 }}
                    >
                      {busy === p.id ? t("sending") : t("sendNote")}
                    </button>
                    <button
                      onClick={() => { setOpenNote(null); setNote(""); }}
                      style={{ height: 38, paddingInline: 16, borderRadius: 10, border: "1px solid var(--border-2)", background: "transparent", color: "var(--slate)", fontSize: 13.5, cursor: "pointer" }}
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, marginBlockStart: 14, flexWrap: "wrap" }}>
                  <button
                    onClick={() => answer(p.id, "approved")}
                    disabled={pending}
                    style={{ height: 38, paddingInline: 18, borderRadius: 10, border: "none", background: "var(--teal-deep)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: pending ? 0.6 : 1 }}
                  >
                    {busy === p.id ? t("sending") : answered ? t("approveAgain") : t("approve")}
                  </button>
                  <button
                    onClick={() => { setOpenNote(p.id); setNote(""); }}
                    disabled={pending}
                    style={{ height: 38, paddingInline: 18, borderRadius: 10, border: "1px solid var(--border-2)", background: "transparent", color: "var(--slate)", fontSize: 13.5, cursor: "pointer" }}
                  >
                    {t("askChanges")}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {err && <div style={{ marginBlockStart: 14, fontSize: 13.5, color: "var(--coral)" }}>{err}</div>}
    </div>
  );
}
