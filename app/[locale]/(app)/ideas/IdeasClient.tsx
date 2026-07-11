"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { generateIdeas, toggleSaveIdea } from "./actions";

type Idea = { id: string; title: string; angle: string | null; postScore: number; status: string };

export function IdeasClient({ ideas }: { ideas: Idea[] }) {
  const t = useTranslations("Ideas");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [filter, setFilter] = useState<"all" | "saved">("all");
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
          r.error === "no_dna"
            ? t("needDna")
            : r.error === "no_key"
              ? t("needKey")
              : r.error === "insufficient_credits"
                ? t("insufficientCredits")
                : t("error"),
        );
    });
  };

  const shown = filter === "saved" ? ideas.filter((i) => saved[i.id]) : ideas;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={t("topicPlaceholder")}
          style={{ flex: "1 1 240px", height: 46, padding: "0 16px", borderRadius: 12, border: "1px solid var(--border-2)", background: "var(--card)", fontSize: 14.5, outline: "none" }}
        />
        <button onClick={gen} disabled={pending} style={{ height: 46, padding: "0 22px", borderRadius: 12, border: "none", cursor: pending ? "default" : "pointer", background: "linear-gradient(135deg,#102A43,#0B1F33)", color: "#fff", fontWeight: 700, fontSize: 14.5, opacity: pending ? 0.7 : 1 }}>
          {pending ? t("generating") : t("generate")}
        </button>
      </div>
      {err && <p style={{ marginBlockStart: 10, color: "var(--coral)", fontSize: 13.5 }}>{err}</p>}

      <div style={{ display: "flex", gap: 8, marginBlock: "18px 4px" }}>
        {(["all", "saved"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: filter === f ? "1.5px solid var(--teal)" : "1.5px solid var(--border-2)", background: filter === f ? "var(--teal-tint-2)" : "var(--card)", color: filter === f ? "var(--navy)" : "var(--slate)" }}>
            {t(f === "all" ? "filterAll" : "filterSaved")}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div style={{ marginBlockStart: 20, textAlign: "center", padding: "50px 20px", border: "1px dashed var(--border-2)", borderRadius: 16, background: "var(--surface)", color: "var(--muted)" }}>
          {t("empty")}
        </div>
      ) : (
        <div style={{ marginBlockStart: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
          {shown.map((i) => (
            <div key={i.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "var(--teal-tint-2)", color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>{nf.format(i.postScore)}</span>
                <button
                  onClick={() => {
                    const next = !saved[i.id];
                    setSaved((s) => ({ ...s, [i.id]: next }));
                    toggleSaveIdea(i.id, next);
                  }}
                  aria-label="save"
                  style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: saved[i.id] ? "var(--gold)" : "var(--subtle)" }}
                >
                  {saved[i.id] ? "★" : "☆"}
                </button>
              </div>
              <div style={{ fontWeight: 700, color: "var(--heading)", lineHeight: 1.6 }}>{i.title}</div>
              {i.angle && <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.7 }}>{i.angle}</div>}
              <Link href="/studio" style={{ marginBlockStart: "auto", display: "inline-flex", alignSelf: "flex-start", height: 38, alignItems: "center", padding: "0 16px", borderRadius: 10, background: "var(--teal)", color: "#fff", fontWeight: 700, fontSize: 13 }}>{t("write")}</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
