"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { generateIdeas, toggleSaveIdea } from "./actions";
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

const FILTERS = ["all", "today", "sources", "trending", "saved"] as const;

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
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>(
    Object.fromEntries(ideas.map((i) => [i.id, i.status === "saved"])),
  );

  const gen = () => {
    setErr(null);
    start(async () => {
      const r = await generateIdeas({ topic });
      if (r.ok) router.refresh();
      else
        setErr(
          r.error === "no_dna" ? t("needDna") : r.error === "no_key" ? t("needKey") : r.error === "insufficient_credits" ? t("insufficientCredits") : t("error"),
        );
    });
  };

  const shown = useMemo(() => {
    return ideas.filter((i) => {
      switch (filter) {
        case "all": return true;
        case "saved": return saved[i.id];
        case "today": return i.bucket === "suggested";
        case "sources": return i.bucket === "source";
        case "trending": return i.bucket === "trending";
        default: return true;
      }
    });
  }, [ideas, filter, saved]);

  const sourceLine = (i: Idea) =>
    i.bucket === "source" ? t("fromSources") : i.bucket === "trending" ? t("fromTrending") : t("fromSuggested");

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
        <button onClick={gen} disabled={pending} style={{ ...btnTeal, height: 42, opacity: pending ? 0.7 : 1 }}>✦ {pending ? t("generating") : t("generate")}</button>
      </div>
      {err && <p style={{ marginBlockStart: 10, color: "var(--coral)", fontSize: 13.5 }}>{err}</p>}

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBlock: "16px 4px" }}>
        {FILTERS.map((f) => (
          <Chip key={f} variant="fill" size="sm" active={filter === f} onClick={() => setFilter(f)}>{t(`f_${f}`)}</Chip>
        ))}
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
                    aria-label="save"
                    style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--card)", cursor: "pointer", fontSize: 15, color: saved[i.id] ? "var(--gold)" : "var(--subtle)" }}
                  >
                    {saved[i.id] ? "★" : "☆"}
                  </button>
                  <Link href="/studio" style={{ ...btnNavy, height: 34, padding: "0 16px", fontSize: 12.5 }}>{t("write")}</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
