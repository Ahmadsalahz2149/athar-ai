"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { StatCard, btnTeal, btnGhost } from "@/components/ui/display";
import type { LinkPage } from "@/lib/link/types";
import { saveMyLink } from "./actions";

const cardStyle: CSSProperties = { background: "var(--surface,#fff)", border: "1px solid var(--border)", borderRadius: 16, padding: "clamp(16px,2.4vw,22px)", marginBlockEnd: 16 };
const label: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--heading)", marginBlockEnd: 6, display: "block" };
const input: CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg,#fff)", fontSize: 14, color: "var(--heading)", fontFamily: "inherit" };

export function MyLinkClient({ handle: initialHandle, page: initialPage, stats, name, locale }: { handle: string; page: LinkPage; stats: { views: number; clicks: number }; name: string; locale: string }) {
  const t = useTranslations("MyLink");
  const router = useRouter();
  const nf = useMemo(() => new Intl.NumberFormat(locale === "ar" ? "ar" : "en"), [locale]);
  const [handle, setHandle] = useState(initialHandle);
  const [headline, setHeadline] = useState(initialPage.headline);
  const [bio, setBio] = useState(initialPage.bio);
  const [links, setLinks] = useState(initialPage.links.length ? initialPage.links : [{ label: "", url: "" }]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const publicUrl = handle ? `${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/l/${handle}` : "";

  const setLink = (i: number, k: "label" | "url", v: string) => setLinks((p) => p.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const addLink = () => setLinks((p) => (p.length < 15 ? [...p, { label: "", url: "" }] : p));
  const removeLink = (i: number) => setLinks((p) => p.filter((_, idx) => idx !== i));

  const save = () =>
    start(async () => {
      setMsg(null);
      const cleanLinks = links.filter((l) => l.label.trim() && l.url.trim());
      const r = await saveMyLink(handle, { headline, bio, links: cleanLinks });
      if (r.ok) { setMsg({ ok: true, text: t("saved") }); router.refresh(); }
      else setMsg({ ok: false, text: r.error === "handle_taken" ? t("errTaken") : r.error === "bad_handle" ? t("errHandle") : t("errGeneric") });
    });

  const copy = () => { if (publicUrl) navigator.clipboard?.writeText(publicUrl).catch(() => {}); };

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 12, marginBlockEnd: 16 }}>
        <StatCard label={t("views")} value={nf.format(stats.views)} tint="var(--teal-tint,#e6f7f4)" />
        <StatCard label={t("clicks")} value={nf.format(stats.clicks)} tint="var(--gold-tint)" />
      </div>

      {/* Public URL */}
      {handle && (
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>{t("yourLink")}</span>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" dir="ltr" style={{ flex: 1, minWidth: 160, fontSize: 13.5, color: "var(--teal-deep)", fontWeight: 600, textDecoration: "none", fontFamily: "var(--font-latin)" }}>{publicUrl} ↗</a>
          <button onClick={copy} style={{ ...btnGhost, height: 34, fontSize: 12.5 }}>{t("copy")}</button>
        </div>
      )}

      {/* Editor */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={label}>{t("handle")}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span dir="ltr" style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-latin)" }}>/{locale}/l/</span>
              <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder={t("handlePh")} dir="ltr" style={{ ...input, fontFamily: "var(--font-latin)" }} />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--subtle)", marginBlockStart: 5 }}>{t("handleHint")}</div>
          </div>
          <div>
            <label style={label}>{t("headline")}</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={name || t("headlinePh")} style={input} />
          </div>
          <div>
            <label style={label}>{t("bio")}</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("bioPh")} rows={2} style={{ ...input, resize: "vertical" }} />
          </div>

          <div>
            <label style={label}>{t("links")}</label>
            <div style={{ display: "grid", gap: 8 }}>
              {links.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input value={l.label} onChange={(e) => setLink(i, "label", e.target.value)} placeholder={t("linkLabelPh")} style={{ ...input, flex: "1 1 120px" }} />
                  <input value={l.url} onChange={(e) => setLink(i, "url", e.target.value)} placeholder={t("linkUrlPh")} dir="ltr" style={{ ...input, flex: "2 1 180px", fontFamily: "var(--font-latin)" }} />
                  <button onClick={() => removeLink(i)} aria-label={t("remove")} style={{ ...btnGhost, height: 40, width: 40, flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
            <button onClick={addLink} style={{ ...btnGhost, height: 34, fontSize: 12.5, marginBlockStart: 8 }}>+ {t("addLink")}</button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
            {msg && <span style={{ fontSize: 13, fontWeight: 600, color: msg.ok ? "var(--teal)" : "var(--danger,#dc2626)" }}>{msg.text}</span>}
            <button onClick={save} disabled={pending} style={{ ...btnTeal, height: 44, paddingInline: 26 }}>{pending ? t("saving") : t("save")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
