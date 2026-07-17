"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ingestFile, ingestText, ingestUrl, type IngestResult } from "./actions";
import { analyzeSource } from "../vault/actions";
import {
  Chip,
  FileTypeBadge,
  StatusPill,
  ProgressMeter,
  btnNavy,
  btnTeal,
} from "@/components/ui/display";

type TypeKey = "video" | "audio" | "pdf" | "book" | "doc" | "link" | "posts";
const TYPES: { key: TypeKey; accept?: string; input: "file" | "url" | "text" }[] = [
  { key: "video", input: "file", accept: "video/*,audio/*" },
  { key: "audio", input: "file", accept: "audio/*" },
  { key: "pdf", input: "file", accept: "application/pdf,.pdf" },
  { key: "book", input: "file", accept: "application/pdf,.pdf,.txt,.md" },
  { key: "doc", input: "file", accept: ".txt,.md,.markdown,.csv,text/*,application/pdf,.pdf" },
  { key: "link", input: "url" },
  { key: "posts", input: "text" },
];

// "ماذا تريد أن يفعل أثر AI؟" — each one really changes what runs.
const ACTIONS = ["analyze_only", "ideas", "posts", "dna", "campaign"] as const;
const LANGS = ["ar", "en", "mixed"] as const;
const CATEGORIES = ["course", "lecture", "book", "script", "live", "interview"] as const;

function TypeIcon({ k }: { k: TypeKey }) {
  const d: Record<TypeKey, string> = {
    video: "M4 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM10 9l4 3-4 3z",
    audio: "M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
    pdf: "M14 3v5h5M6 3h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    book: "M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 3v18",
    doc: "M14 3v5h5M6 3h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 13h8M8 17h5",
    link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
    posts: "M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z",
  };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d={d[k]} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IngestPanel() {
  const t = useTranslations("Ingest");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [typeKey, setTypeKey] = useState<TypeKey>("video");
  const type = TYPES.find((x) => x.key === typeKey)!;
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [actions, setActions] = useState<string[]>(["dna", "ideas"]);
  const [language, setLanguage] = useState<string>("ar");
  const [category, setCategory] = useState<string>("course");
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<IngestResult | null>(null);
  const [phase, setPhase] = useState<"idle" | "ingesting" | "analyzing" | "done">("idle");

  const toggleAction = (a: string) => setActions((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]));

  const ready = type.input === "file" ? !!file : type.input === "url" ? !!url.trim() : text.trim().length >= 150;

  const run = () => {
    setRes(null);
    setPhase("ingesting");
    start(async () => {
      try {
        const opts = { language, category, actions };
        let r: IngestResult;
        if (type.input === "file" && file) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("language", language);
          fd.append("category", category);
          r = await ingestFile(fd);
        } else if (type.input === "url") {
          r = await ingestUrl({ url, opts });
        } else {
          r = await ingestText({ text, title: t("pastedTitle"), opts });
        }
        setRes(r);
        if (!r.ok) return setPhase("idle");

        // Selected actions genuinely drive what happens next.
        if (actions.includes("ideas") && !actions.includes("analyze_only")) {
          setPhase("analyzing");
          await analyzeSource(r.sourceId);
        }
        setPhase("done");
        router.refresh();
        if (actions.includes("posts")) router.push("/studio");
      } catch (e) {
        setRes({ ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) });
        setPhase("idle");
      }
    });
  };

  return (
    <div>
      {/* Dropzone / input */}
      {type.input === "file" && (
        <div
          onClick={() => !pending && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f && !pending) setFile(f);
          }}
          style={{
            border: `2px dashed ${drag ? "var(--teal)" : "var(--border-2)"}`,
            borderRadius: 18,
            padding: "40px 20px",
            textAlign: "center",
            background: drag ? "var(--teal-tint-2)" : "var(--surface)",
            cursor: pending ? "default" : "pointer",
          }}
        >
          <input ref={inputRef} type="file" accept={type.accept} hidden onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
            e.target.value = "";
          }} />
          <div style={{ width: 52, height: 52, margin: "0 auto", borderRadius: 14, display: "grid", placeItems: "center", background: "var(--teal-tint)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0-11 4 4m-4-4-4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="#0E9488" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockStart: 12, fontSize: 16 }}>{t("dropTitle")}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBlockStart: 6 }}>{t("dropHelper")}</div>
          <span style={{ ...btnTeal, marginBlockStart: 14 }}>{t("pickFile")}</span>
          {file && (
            <div style={{ marginBlockStart: 14, display: "inline-flex", alignItems: "center", gap: 9, padding: "8px 12px", borderRadius: 10, background: "var(--card)", border: "1px solid var(--border)" }}>
              <FileTypeBadge label={(file.name.split(".").pop() ?? "TXT").toUpperCase()} size={26} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--heading)" }}>{file.name}</span>
              <span style={{ fontSize: 11.5, color: "var(--muted)", fontFamily: "var(--font-latin)" }}>{(file.size / 1048576).toFixed(1)} MB</span>
            </div>
          )}
        </div>
      )}
      {type.input === "url" && (
        <div style={cardBox}>
          <div style={label}>{t("urlTitle")}</div>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("urlPlaceholder")} dir="ltr" style={{ ...inp, textAlign: "start" }} />
        </div>
      )}
      {type.input === "text" && (
        <div style={cardBox}>
          <div style={label}>{t("textTitle")}</div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={t("textPlaceholder")} className="scb" style={{ ...inp, height: "auto", padding: 12, lineHeight: 1.8, resize: "vertical" }} />
        </div>
      )}

      {/* Content type — icon tiles */}
      <div style={{ marginBlockStart: 22 }}>
        <div style={label}>{t("typesLabel")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBlockStart: 10 }}>
          {TYPES.map((ty) => {
            const on = ty.key === typeKey;
            return (
              <button
                key={ty.key}
                onClick={() => {
                  setTypeKey(ty.key);
                  setFile(null);
                  setRes(null);
                }}
                style={{
                  display: "grid",
                  justifyItems: "center",
                  gap: 7,
                  width: 88,
                  padding: "13px 6px",
                  borderRadius: 14,
                  cursor: "pointer",
                  background: on ? "var(--teal-tint-2)" : "var(--card)",
                  border: on ? "1.5px solid var(--teal)" : "1.5px solid var(--border-2)",
                  color: on ? "var(--teal-deep)" : "var(--slate)",
                }}
              >
                <TypeIcon k={ty.key} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: on ? "var(--navy)" : "var(--slate)" }}>{t(`mode_${ty.key}`)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* What should Athar do? */}
      <div style={{ ...cardBox, marginBlockStart: 22 }}>
        <div style={label}>{t("actionsLabel")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginBlockStart: 10 }}>
          {ACTIONS.map((a) => (
            <Chip key={a} active={actions.includes(a)} onClick={() => toggleAction(a)}>
              {t(`act_${a}`)}
            </Chip>
          ))}
        </div>
      </div>

      {/* Language + category */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18, marginBlockStart: 22 }}>
        <div>
          <div style={label}>{t("langLabel")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginBlockStart: 10 }}>
            {LANGS.map((l) => (
              <Chip key={l} variant="fill" active={language === l} onClick={() => setLanguage(l)}>{t(`lang_${l}`)}</Chip>
            ))}
          </div>
        </div>
        <div>
          <div style={label}>{t("catLabel")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginBlockStart: 10 }}>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{t(`cat_${c}`)}</Chip>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={run}
        disabled={pending || !ready}
        style={{ ...btnNavy, width: "100%", height: 52, marginBlockStart: 22, fontSize: 15, opacity: pending || !ready ? 0.55 : 1 }}
      >
        ✦ {phase === "ingesting" ? t("running") : phase === "analyzing" ? t("analyzingNow") : t("startAnalysis")}
      </button>

      {/* Progress / result */}
      {phase !== "idle" && (
        <div style={{ ...cardBox, marginBlockStart: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 10 }}>
            {phase === "done" ? <StatusPill tone="teal" dot>{t("donePill")}</StatusPill> : <StatusPill tone="amber" dot>{t("workingPill")}</StatusPill>}
          </div>
          <ProgressMeter pct={phase === "done" ? 100 : phase === "analyzing" ? 75 : 40} />
          {res && res.ok && phase === "done" && (
            <p style={{ marginBlockStart: 12, fontSize: 13.5, color: "var(--teal-deep)", fontWeight: 600 }}>
              {t("ingestDone", { chunks: nf.format(res.chunks), total: nf.format(res.totalChunks) })}
            </p>
          )}
        </div>
      )}
      {res && !res.ok && (
        <p style={{ marginBlockStart: 14, padding: "11px 14px", borderRadius: 12, background: "var(--coral-tint)", border: "1px solid rgba(224,101,74,.3)", color: "var(--coral)", fontSize: 13.5 }}>
          {errorMessage(res, t)}
        </p>
      )}
    </div>
  );
}

function errorMessage(res: { error: string; message?: string }, t: (k: string) => string): string {
  const base = (() => {
    switch (res.error) {
      case "unsupported": return t("unsupported");
      case "too_big": return t("tooBig");
      case "no_transcribe_key": return t("needTranscribeKey");
      case "no_embed_key": return t("needEmbedKey");
      case "insufficient_credits": return t("insufficientCredits");
      case "no_session": return t("needSession");
      case "empty": return t("emptyExtract");
      case "too_few": return t("needText");
      default: return t("ingestError");
    }
  })();
  return res.message ? `${base} (${res.message})` : base;
}

const cardBox: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 };
const label: React.CSSProperties = { fontSize: 13.5, fontWeight: 700, color: "var(--heading)" };
const inp: React.CSSProperties = {
  width: "100%",
  height: 46,
  padding: "0 14px",
  marginBlockStart: 10,
  borderRadius: 12,
  border: "1px solid var(--border-2)",
  background: "var(--card)",
  fontSize: 14,
  outline: "none",
};
