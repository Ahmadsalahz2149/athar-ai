"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Chip, FileTypeBadge, StatusPill, EmptyState, btnNavy, btnGhost, btnTeal } from "@/components/ui/display";
import { deleteSource, renameSource, retrySource, semanticSearchSources } from "./actions";

export type VaultSource = {
  id: string;
  kind: string;
  title: string | null;
  label: string;
  chunks: number;
  drafts: number;
  analyzed: boolean;
  status: string;
  createdAt: string;
  language: string | null;
  category: string | null;
  summary: string | null;
};

const FILTERS = ["all", "video", "audio", "pdf", "link", "posts", "analyzed", "needs"] as const;

export function VaultClient({ sources }: { sources: VaultSource[] }) {
  const t = useTranslations("Vault");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const df = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { day: "numeric", month: "long", year: "numeric" });
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmDel, setConfirmDel] = useState<string[] | null>(null);
  const [pending, start] = useTransition();
  // Semantic search: null = plain text filter; array = ordered source IDs from retrieve().
  const [semanticIds, setSemanticIds] = useState<string[] | null>(null);
  const [semPending, startSem] = useTransition();
  const [semUnavailable, setSemUnavailable] = useState(false);
  // Rename-in-place.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const runSemantic = () => {
    if (q.trim().length < 2) return;
    setSemUnavailable(false);
    startSem(async () => {
      const r = await semanticSearchSources(q);
      if (!r.ok) { setSemUnavailable(true); return; }
      setSemanticIds(r.sourceIds ?? []);
    });
  };
  const clearSemantic = () => { setSemanticIds(null); setSemUnavailable(false); };

  const saveRename = (id: string) => {
    const title = renameVal.trim();
    if (!title) { setRenamingId(null); return; }
    start(async () => {
      await renameSource(id, title);
      setRenamingId(null);
      router.refresh();
    });
  };

  const retry = (id: string) => start(async () => {
    await retrySource(id);
    router.refresh();
  });

  const count = (f: (typeof FILTERS)[number]) =>
    sources.filter((s) => {
      switch (f) {
        case "all": return true;
        case "analyzed": return s.analyzed;
        case "needs": return !s.analyzed;
        case "video": return s.kind === "video";
        case "audio": return s.kind === "audio";
        case "pdf": return s.kind === "pdf";
        case "link": return s.kind === "url";
        case "posts": return s.kind === "text";
        default: return true;
      }
    }).length;

  const selIds = Object.keys(selected).filter((k) => selected[k]);
  const runDelete = (ids: string[]) =>
    start(async () => {
      for (const id of ids) await deleteSource(id);
      setSelected({});
      setConfirmDel(null);
      router.refresh();
    });

  const matchesFilter = (s: VaultSource) => {
    switch (filter) {
      case "all": return true;
      case "analyzed": return s.analyzed;
      case "needs": return !s.analyzed;
      case "video": return s.kind === "video";
      case "audio": return s.kind === "audio";
      case "pdf": return s.kind === "pdf";
      case "link": return s.kind === "url";
      case "posts": return s.kind === "text";
      default: return true;
    }
  };

  const shown = useMemo(() => {
    // Semantic mode: honor retrieve() ranking, then apply the active filter.
    if (semanticIds) {
      const byId = new Map(sources.map((s) => [s.id, s]));
      return semanticIds.map((id) => byId.get(id)).filter((s): s is VaultSource => !!s && matchesFilter(s));
    }
    const term = q.trim().toLowerCase();
    return sources.filter((s) => {
      if (term && !(s.title ?? "").toLowerCase().includes(term) && !(s.summary ?? "").toLowerCase().includes(term)) return false;
      return matchesFilter(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, q, filter, semanticIds]);

  return (
    <>
      {/* Search */}
      <div style={{ display: "flex", gap: 8, marginBlockStart: 18 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); if (semanticIds) clearSemantic(); }}
            onKeyDown={(e) => { if (e.key === "Enter") runSemantic(); }}
            placeholder={t("searchPh")}
            style={{ width: "100%", height: 48, padding: "0 44px 0 14px", borderRadius: 13, border: "1px solid var(--border-2)", background: "var(--card)", fontSize: 14.5, outline: "none" }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", insetInlineEnd: 15, insetBlockStart: 15 }}>
            <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" stroke="var(--subtle)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <button onClick={runSemantic} disabled={semPending || q.trim().length < 2} title={t("semanticHint")} style={{ ...btnGhost, height: 48, flex: "none", paddingInline: 16, fontSize: 13, opacity: semPending || q.trim().length < 2 ? 0.55 : 1 }}>
          ✦ {semPending ? t("searching") : t("semanticBtn")}
        </button>
      </div>
      {(semanticIds || semUnavailable) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockStart: 10, fontSize: 12.5 }}>
          {semanticIds ? (
            <>
              <span style={{ color: "var(--teal-deep)", fontWeight: 600 }}>✦ {t("semanticActive", { n: nf.format(semanticIds.length) })}</span>
              <button onClick={clearSemantic} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", textDecoration: "underline", fontSize: 12.5 }}>{t("clearSemantic")}</button>
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}>{t("semanticUnavailable")}</span>
          )}
        </div>
      )}

      {/* Filters with counts */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBlockStart: 14 }}>
        {FILTERS.map((f) => {
          const n = count(f);
          return (
            <Chip key={f} variant="fill" size="sm" active={filter === f} onClick={() => setFilter(f)}>
              {t(`f_${f}`)} {n > 0 && <span style={{ fontFamily: "var(--font-latin)", opacity: 0.7 }}>{nf.format(n)}</span>}
            </Chip>
          );
        })}
      </div>

      {/* Bulk bar */}
      {selIds.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBlockStart: 14, padding: "10px 16px", borderRadius: 12, background: "var(--teal-tint-2)", border: "1px solid rgba(20,184,166,.3)" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--teal-deep)" }}>{t("selectedN", { n: nf.format(selIds.length) })}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setSelected({})} style={{ ...btnGhost, height: 34, fontSize: 12.5 }}>{t("clearSel")}</button>
            <button onClick={() => setConfirmDel(selIds)} disabled={pending} style={{ ...btnGhost, height: 34, fontSize: 12.5, color: "var(--coral)", borderColor: "rgba(224,101,74,.3)" }}>{t("deleteSel")}</button>
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <div style={{ marginBlockStart: 24 }}>
          <EmptyState
            title={sources.length === 0 ? t("emptyTitle") : t("noMatchTitle")}
            body={sources.length === 0 ? t("emptyBody") : t("noMatchBody")}
            cta={sources.length === 0 ? <Link href="/ingest" style={btnNavy}>{t("addSource")}</Link> : undefined}
          />
        </div>
      ) : (
        <div style={{ marginBlockStart: 20, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
          {shown.map((s) => (
            <div key={s.id} style={{ background: "var(--card)", border: selected[s.id] ? "1.5px solid var(--teal)" : "1px solid var(--border)", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                <input type="checkbox" checked={!!selected[s.id]} onChange={(e) => setSelected((v) => ({ ...v, [s.id]: e.target.checked }))} aria-label={t("select")} style={{ width: 16, height: 16, marginBlockStart: 4, accentColor: "var(--teal)", flex: "none" }} />
                <FileTypeBadge label={s.label} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renamingId === s.id ? (
                    <input
                      autoFocus
                      value={renameVal}
                      onChange={(e) => setRenameVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveRename(s.id); if (e.key === "Escape") setRenamingId(null); }}
                      onBlur={() => saveRename(s.id)}
                      aria-label={t("renameLabel")}
                      style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 8, border: "1px solid var(--teal)", background: "var(--card)", fontSize: 14, fontWeight: 700, color: "var(--heading)", outline: "none" }}
                    />
                  ) : (
                    <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.title || t("untitled")}
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginBlockStart: 3 }}>{df.format(new Date(s.createdAt))}</div>
                </div>
                <button onClick={() => { setRenamingId(s.id); setRenameVal(s.title || ""); }} aria-label={t("renameLabel")} style={{ width: 30, height: 30, flex: "none", borderRadius: 8, border: "1px solid var(--border-2)", background: "var(--card)", cursor: "pointer", color: "var(--subtle)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto" }}><path d="M4 20h4L18 10l-4-4L4 16zM14 6l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button onClick={() => setConfirmDel([s.id])} aria-label={t("delete")} style={{ width: 30, height: 30, flex: "none", borderRadius: 8, border: "1px solid var(--border-2)", background: "var(--card)", cursor: "pointer", color: "var(--subtle)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto" }}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>

              {s.summary && (
                <p style={{ fontSize: 13, color: "var(--slate-2)", lineHeight: 1.75, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {s.summary}
                </p>
              )}

              {(s.category || s.language) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {s.category && <Tag>{t(`cat_${s.category}`)}</Tag>}
                  {s.language && <Tag>{t(`lang_${s.language}`)}</Tag>}
                </div>
              )}

              <div style={{ display: "flex", gap: 18, padding: "10px 0", borderBlock: "1px solid var(--border)" }}>
                <Stat n={nf.format(s.chunks)} label={t("statChunks")} />
                <Stat n={nf.format(s.drafts)} label={t("statPosts")} />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                {s.status === "processing" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "var(--gold-dark)" }}>
                    <span className="skeleton" style={{ width: 11, height: 11, borderRadius: "50%" }} />
                    {t("processing")}
                  </span>
                ) : s.status === "failed" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StatusPill tone="red">{t("failed")}</StatusPill>
                    <button onClick={() => retry(s.id)} disabled={pending} style={{ ...btnGhost, height: 30, fontSize: 12, color: "var(--teal-deep)" }}>↻ {t("retry")}</button>
                  </div>
                ) : (
                  <StatusPill tone={s.analyzed ? "teal" : "amber"}>{s.analyzed ? t("analyzed") : t("needsAnalysis")}</StatusPill>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, marginBlockStart: "auto" }}>
                <Link href={`/vault/${s.id}`} style={{ ...btnNavy, flex: 1, height: 38, fontSize: 12.5 }}>{t("viewAnalysis")}</Link>
                <Link href="/studio" style={{ ...btnGhost, flex: 1, height: 38, fontSize: 12.5 }}>{t("generate")}</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDel && (
        <div onClick={() => setConfirmDel(null)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(8,24,38,.5)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "var(--card)", borderRadius: 18, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "var(--heading)", marginBlockEnd: 8 }}>{t("deleteTitle")}</div>
            <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.7, marginBlockEnd: 18 }}>{t("deleteBody", { n: nf.format(confirmDel.length) })}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDel(null)} style={{ ...btnGhost, height: 40 }}>{t("cancel")}</button>
              <button onClick={() => runDelete(confirmDel)} disabled={pending} style={{ ...btnTeal, height: 40, background: "var(--coral)" }}>{t("confirmDelete")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "var(--border-3)", color: "var(--slate-2)" }}>
      {children}
    </span>
  );
}
function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--heading)", fontFamily: "var(--font-latin)" }}>{n}</div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
    </div>
  );
}
