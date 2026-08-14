"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { generateIdeas, toggleSaveIdea, markIdeaUsed, batchGenerate, scheduleIdea } from "./actions";
import { Chip, StatusPill, EmptyState, IconTile, GlyphIcon, btnTeal, btnNavy } from "@/components/ui/display";

type Idea = {
  id: string;
  title: string;
  angle: string | null;
  category: string | null;
  bucket: string;
  postScore: number;
  status: string;
};

// "trending" is intentionally omitted — we don't produce trending-bucket ideas
// yet, so an always-empty filter would read as broken.
const FILTERS = ["all", "today", "sources", "saved"] as const;
const SORTS = ["score", "recent"] as const;

const CAT_GLYPH: Record<string, string> = {
  educational: "book", story: "message", list: "warn", guide: "target", analytical: "chart", contrarian: "flame",
};
const CAT_TINT: Record<string, string> = {
  educational: "var(--blue-tint)", story: "var(--teal-tint)", list: "var(--gold-tint)",
  guide: "var(--coral-tint)", analytical: "var(--blue-tint)", contrarian: "var(--coral-tint)",
};

export function IdeasClient({ ideas }: { ideas: Idea[] }) {
  const t = useTranslations("Ideas");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(6);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("score");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>(
    Object.fromEntries(ideas.map((i) => [i.id, i.status === "saved"])),
  );

  // Batch generation (#8): select ideas → generate drafts for all at once.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchPending, startBatch] = useTransition();
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else if (next.size < 4) next.add(id);
      return next;
    });
  const runBatch = () => {
    setBatchMsg(null);
    startBatch(async () => {
      const r = await batchGenerate([...selected]);
      if (r.ok) { setBatchMsg(t("batchDone", { n: nf.format(r.created) })); setSelected(new Set()); router.refresh(); }
      else setBatchMsg(r.error === "no_dna" ? t("needDna") : r.error === "insufficient_credits" ? t("insufficientCredits") : t("error"));
    });
  };

  const gen = () => {
    setErr(null);
    start(async () => {
      const r = await generateIdeas({ topic, count });
      if (r.ok) router.refresh();
      else
        setErr(
          r.error === "no_dna" ? t("needDna") : r.error === "no_key" ? t("needKey") : r.error === "insufficient_credits" ? t("insufficientCredits") : t("error"),
        );
    });
  };

  // Open an idea in the Studio with its context, and mark it used (lineage).
  const write = (i: Idea) => {
    markIdeaUsed(i.id);
    const prompt = i.angle ? `${i.title} — ${i.angle}` : i.title;
    router.push(`/studio?prompt=${encodeURIComponent(prompt)}`);
  };

  // Idea → Calendar direct: compose + schedule (tomorrow 10:00) in one step.
  const [schedId, setSchedId] = useState<string | null>(null);
  const schedule = (i: Idea) => {
    setSchedId(i.id);
    setErr(null);
    start(async () => {
      const r = await scheduleIdea(i.id);
      setSchedId(null);
      if (r.ok) { setBatchMsg(t("scheduledToast")); router.refresh(); }
      else setErr(r.error === "no_dna" ? t("needDna") : r.error === "no_key" ? t("needKey") : r.error === "insufficient_credits" ? t("insufficientCredits") : t("error"));
    });
  };

  const shown = useMemo(() => {
    const filtered = ideas.filter((i) => {
      switch (filter) {
        case "all": return true;
        case "saved": return saved[i.id];
        case "today": return i.bucket === "suggested";
        case "sources": return i.bucket === "source";
        default: return true;
      }
    });
    return [...filtered].sort((a, b) => (sort === "score" ? b.postScore - a.postScore : 0));
  }, [ideas, filter, saved, sort]);

  const sourceLine = (i: Idea) => (i.bucket === "source" ? t("fromSources") : t("fromSuggested"));

  const statusPill = (i: Idea) => {
    if (saved[i.id]) return <StatusPill tone="amber">{t("stSaved")}</StatusPill>;
    if (i.status === "used") return <StatusPill tone="neutral">{t("stUsed")}</StatusPill>;
    return <StatusPill tone="teal">{t("stNew")}</StatusPill>;
  };

  return (
    <div>
      {/* Generator bar */}
      <div style={{ background: "linear-gradient(160deg,var(--navy-2),var(--navy))", borderRadius: 14, padding: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#9FB3C8", fontWeight: 600, paddingInline: 6, flex: "none" }}>{t("aboutWhat")}</span>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("topicPlaceholder")} onKeyDown={(e) => e.key === "Enter" && !pending && gen()} style={{ flex: 1, minWidth: 160, height: 42, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 11, padding: "0 14px", color: "#fff", fontSize: 14, outline: "none" }} />
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label={t("countLabel")} style={{ height: 42, borderRadius: 11, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", color: "#fff", fontSize: 13, padding: "0 10px", outline: "none" }}>
          {[3, 6, 8, 10].map((n) => <option key={n} value={n} style={{ color: "#000" }}>{nf.format(n)}</option>)}
        </select>
        <button onClick={gen} disabled={pending} style={{ ...btnTeal, height: 42, opacity: pending ? 0.7 : 1 }}>{pending ? t("generating") : t("generate")}</button>
      </div>
      {err && <p style={{ marginBlockStart: 10, color: "var(--coral)", fontSize: 13.5 }}>{err}</p>}

      {/* Filters + sort */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBlock: "16px 4px", alignItems: "center" }}>
        {FILTERS.map((f) => (
          <Chip key={f} variant="fill" size="sm" active={filter === f} onClick={() => setFilter(f)}>{t(`f_${f}`)}</Chip>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])} aria-label={t("sortLabel")} style={{ marginInlineStart: "auto", height: 34, borderRadius: 999, border: "1px solid var(--border-2)", background: "var(--card)", fontSize: 12.5, padding: "0 12px", color: "var(--slate)", outline: "none" }}>
          {SORTS.map((s) => <option key={s} value={s}>{t(`sort_${s}`)}</option>)}
        </select>
      </div>

      {shown.length === 0 ? (
        <div style={{ marginBlockStart: 20 }}>
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        </div>
      ) : (
        <div className="dtable-wrap" style={{ marginBlockStart: 16 }}>
          <div className="dtable-scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th style={{ width: 40 }}><span className="sr-only">{t("selectForBatch")}</span></th>
                  <th>{t("colIdea")}</th>
                  <th style={{ width: 120 }}>{t("colCategory")}</th>
                  <th style={{ width: 130 }}>{t("colSource")}</th>
                  <th style={{ width: 96 }} className="dt-num">Post Score</th>
                  <th style={{ width: 92 }}>{t("colStatus")}</th>
                  <th style={{ width: 150 }}>{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const selCap = !selected.has(i.id) && selected.size >= 4;
                  return (
                    <tr key={i.id} className={selected.has(i.id) ? "is-selected" : undefined}>
                      <td>
                        <input type="checkbox" checked={selected.has(i.id)} disabled={selCap} onChange={() => toggleSelect(i.id)} aria-label={t("selectForBatch")} title={selCap ? t("batchMax") : undefined} style={{ width: 16, height: 16, accentColor: "var(--teal)", display: "block", opacity: selCap ? 0.4 : 1 }} />
                      </td>
                      <td style={{ maxWidth: 380 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <IconTile tint={CAT_TINT[i.category ?? "educational"] ?? "var(--teal-tint)"} size={32}><GlyphIcon name={CAT_GLYPH[i.category ?? "educational"] ?? "bulb"} size={16} color="var(--teal-deep)" /></IconTile>
                          <div style={{ minWidth: 0 }}>
                            <div className="dt-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</div>
                            {i.angle && <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBlockStart: 2 }}>{i.angle}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        {i.category && <span style={{ padding: "3px 9px", borderRadius: 999, background: "var(--gold-tint)", color: "var(--gold-dark)", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>{t(`cat_${i.category}`)}</span>}
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: 12.5, whiteSpace: "nowrap" }}>{sourceLine(i)}</td>
                      <td className="dt-num" style={{ fontWeight: 700, color: "var(--teal-deep)" }}>{nf.format(i.postScore)}</td>
                      <td>{statusPill(i)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => { const next = !saved[i.id]; setSaved((s) => ({ ...s, [i.id]: next })); toggleSaveIdea(i.id, next); }}
                            aria-label={saved[i.id] ? t("unsave") : t("save")}
                            aria-pressed={!!saved[i.id]}
                            title={saved[i.id] ? t("unsave") : t("save")}
                            className="dt-iconbtn"
                            style={{ color: saved[i.id] ? "var(--gold)" : "var(--subtle)" }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill={saved[i.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z" /></svg>
                          </button>
                          <button onClick={() => schedule(i)} disabled={pending} title={t("scheduleHint")} aria-label={t("schedule")} className="dt-iconbtn" style={{ opacity: schedId === i.id ? 0.6 : 1 }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9h16M8 3v4M16 3v4" /></svg>
                          </button>
                          <button onClick={() => write(i)} style={{ ...btnNavy, height: 30, padding: "0 14px", fontSize: 12.5 }}>{t("write")}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch generation bar (#8) — appears when ideas are selected */}
      {(selected.size > 0 || batchMsg) && (
        <div className="glass-bar" style={{ position: "sticky", insetBlockEnd: 12, marginBlockStart: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderRadius: 14, border: "1px solid var(--teal)", background: "var(--surface,#fff)", boxShadow: "0 6px 24px rgba(16,42,67,.12)" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--heading)", flex: 1, minWidth: 140 }}>
            {batchMsg ?? t("batchSelected", { n: nf.format(selected.size) })}
          </span>
          {selected.size > 0 && (
            <>
              <button onClick={() => { setSelected(new Set()); setBatchMsg(null); }} style={{ ...btnNavy, background: "transparent", color: "var(--slate)", border: "1px solid var(--border-2)", height: 40 }}>{t("batchClear")}</button>
              <button onClick={runBatch} disabled={batchPending} style={{ ...btnTeal, height: 40, opacity: batchPending ? 0.7 : 1 }}>{batchPending ? t("batchRunning") : t("batchGenerate", { n: nf.format(selected.size) })}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
