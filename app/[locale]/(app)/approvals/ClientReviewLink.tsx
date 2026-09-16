"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { btnNavy, btnGhost } from "@/components/ui/display";
import { createReviewLink, reviewLinks, revokeReviewLink, type ReviewLinkRow } from "./review-link-actions";

/**
 * "Show this month's posts to your client" (Phase 4).
 *
 * The approval flow already existed; what an agency could not do was let the
 * person who actually signs off see it. This makes a link that opens a
 * read-and-answer view of the review queue — and nothing else in the workspace.
 */
export function ClientReviewLink() {
  const t = useTranslations("ReviewLink");
  const [links, setLinks] = useState<ReviewLinkRow[] | null>(null);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => {
      const r = await reviewLinks();
      if (r.ok) setLinks(r.links);
      else setErr(t("errLoad"));
    });

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!links) return null;

  const create = () =>
    start(async () => {
      setErr("");
      setCopied(false);
      const r = await createReviewLink(label, window.location.origin);
      if (!r.ok) { setErr(t(`err_${r.error}`)); return; }
      setFresh(r.url);
      setLabel("");
      load();
    });

  const revoke = (id: string) =>
    start(async () => {
      setErr("");
      const r = await revokeReviewLink(id);
      if (!r.ok) { setErr(t("errGeneric")); return; }
      setFresh(null);
      load();
    });

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
    } catch {
      setCopied(false); // the field is selectable; a blocked clipboard is not worth an error
    }
  };

  const active = links.filter((l) => l.state === "active");

  return (
    <section style={{ marginBlockEnd: 22, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
      <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 14.5 }}>{t("title")}</div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBlock: "6px 14px", lineHeight: 1.85 }}>{t("subtitle")}</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("labelPlaceholder")}
          style={{ flex: "1 1 200px", height: 38, borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--heading)", paddingInline: 12, fontSize: 13.5 }}
        />
        <button onClick={create} disabled={pending} style={{ ...btnNavy, height: 38, fontSize: 13, opacity: pending ? 0.6 : 1 }}>{t("create")}</button>
      </div>

      {fresh && (
        <div style={{ marginBlockStart: 12, padding: "12px 14px", borderRadius: 12, background: "var(--teal-tint-2)", border: "1px solid rgba(15,118,110,.25)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--teal-deep)" }}>{t("ready")}</div>
          <p style={{ fontSize: 12.5, color: "var(--slate)", marginBlock: "5px 9px", lineHeight: 1.8 }}>{t("readyHint")}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              readOnly
              value={fresh}
              onFocus={(e) => e.currentTarget.select()}
              style={{ flex: "1 1 240px", height: 36, borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--slate)", paddingInline: 10, fontSize: 12.5, direction: "ltr", fontFamily: "var(--font-latin)" }}
            />
            <button onClick={copy} style={{ ...btnGhost, height: 36, fontSize: 13 }}>{copied ? t("copied") : t("copy")}</button>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div style={{ marginBlockStart: 14, display: "grid", gap: 8 }}>
          {active.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 13px", borderRadius: 11, border: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--slate)" }}>
                {l.label || t("unlabelled")}
                <span style={{ color: "var(--muted)" }}> · {l.lastUsedAt ? t("used") : t("neverUsed")}</span>
              </span>
              <button onClick={() => revoke(l.id)} disabled={pending} style={{ ...btnGhost, height: 32, fontSize: 12.5 }}>{t("revoke")}</button>
            </div>
          ))}
        </div>
      )}

      {err && <div style={{ marginBlockStart: 10, fontSize: 13, color: "var(--coral)" }}>{err}</div>}
    </section>
  );
}
