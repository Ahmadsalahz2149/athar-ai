"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { generateIdeas, toggleSaveIdea, markIdeaUsed } from "./actions";
import { Chip, StatusPill, EmptyState, IconTile, btnTeal, btnNavy } from "@/components/ui/display";

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

const CAT_EMOJI: Record<string, string> = {
  educational: "📖", story: "💬", list: "⚠️", guide: "🎯", analytical: "📊", contrarian: "🔥",
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
      <div style={{ background: "linear-gradient(160deg,#102A43,#0B1F33)", borderRadius: 14, padding: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#9FB3C8", fontWeight: 600, paddingInline: 6, flex: "none" }}>{t("aboutWhat")}</span>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("topicPlaceholder")} onKeyDown={(e) => e.key === "Enter" && !pending && gen()} style={{ flex: 1, minWidth: 160, height: 42, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 11, padding: "0 14px", color: "#fff", fontSize: 14, outline: "none" }} />
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label={t("countLabel")} style={{ height: 42, borderRadius: 11, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", color: "#fff", fontSize: 13, padding: "0 10px", outline: "none" }}>
          {[3, 6, 8, 10].map((n) => <option key={n} value={n} style={{ color: "#000" }}>{nf.format(n)}</option>)}
        </select>
        <button onClick={gen} disabled={pending} style={{ ...btnTeal, height: 42, opacity: pending ? 0.7 : 1 }}>✦ {pending ? t("generating") : t("generate")}</button>
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
        <div style={{ marginBlockStart: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
          {shown.map((i) => (
            <div key={i.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <IconTile tint={CAT_TINT[i.category ?? "educational"] ?? "var(--teal-tint)"} size={38}>{CAT_EMOJI[i.category ?? "educational"] ?? "💡"}</IconTile>
                {statusPill(i)}
              </div>
              <div style={{ fontWeight: 700, color: "var(--heading)", lineHeight: 1.6, fontSize: 15 }}>{i.title}</div>
              {i.angle && <div style={{ fontSize: 13, color: "var(--slate-2)", lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{i.angle}</div>}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12 }}>
                {i.category && <span style={{ padding: "3px 9px", borderRadius: 999, background: "var(--gold-tint)", color: "var(--gold-dark)", fontWeight: 600 }}>{t(`cat_${i.category}`)}</span>}
                <span style={{ color: "var(--muted)" }}>{sourceLine(i)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBlockStart: "auto", paddingBlockStart: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>Post Score {nf.format(i.postScore)}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => {
                      const next = !saved[i.id];
                      setSaved((s) => ({ ...s, [i.id]: next }));
                      toggleSaveIdea(i.id, next);
                    }}
                    aria-label={saved[i.id] ? t("unsave") : t("save")}
                    aria-pressed={!!saved[i.id]}
                    style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--card)", cursor: "pointer", fontSize: 15, color: saved[i.id] ? "var(--gold)" : "var(--subtle)" }}
                  >
                    {saved[i.id] ? "★" : "☆"}
                  </button>
                  <button onClick={() => write(i)} style={{ ...btnNavy, height: 34, padding: "0 16px", fontSize: 12.5 }}>{t("write")}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
