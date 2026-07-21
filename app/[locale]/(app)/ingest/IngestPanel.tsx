"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ingestFile, ingestText, ingestUrl, jobStatus, type IngestResult } from "./actions";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll a job to completion, reporting progress. Terminal states are done | dead. */
async function pollJob(jobId: string, onTick: (progress: number, phase: string | null) => void): Promise<{ done: boolean; chunks?: number; error?: string }> {
  for (let i = 0; i < 200; i++) {
    const s = await jobStatus(jobId);
    if (s.ok) {
      onTick(s.progress, s.phase);
      if (s.status === "done") return { done: true, chunks: s.chunks };
      if (s.status === "dead") return { done: false, error: s.error ?? "failed" };
    }
    await sleep(1500);
  }
  return { done: false, error: "timeout" };
}
import {
  Chip,
  FileTypeBadge,
  StatusPill,
  ProgressMeter,
  btnNavy,
  btnTeal,
} from "@/components/ui/display";

const MAX_FILE_MB = 30; // mirrors MAX_FILE_BYTES in actions.ts / next.config bodySizeLimit

type QStatus = "queued" | "uploading" | "analyzing" | "done" | "error" | "toobig";
type QItem = { id: number; file: File; status: QStatus; error?: string; chunks?: number; progress?: number };

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
  const [queue, setQueue] = useState<QItem[]>([]);
  const idSeq = useRef(0);
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

  // Append picked/dropped files to the queue, flagging over-size ones up front.
  const addFiles = (list: FileList | File[]) => {
    const items: QItem[] = Array.from(list).map((f) => ({
      id: idSeq.current++,
      file: f,
      status: f.size > MAX_FILE_MB * 1048576 ? "toobig" : "queued",
    }));
    setQueue((q) => [...q, ...items]);
    setRes(null);
  };
  const removeItem = (id: number) => setQueue((q) => q.filter((i) => i.id !== id));
  const setItem = (id: number, patch: Partial<QItem>) => setQueue((q) => q.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const runnable = queue.filter((i) => i.status === "queued" || i.status === "error");
  const ready = type.input === "file" ? runnable.length > 0 : type.input === "url" ? !!url.trim() : text.trim().length >= 150;

  const run = () => {
    setRes(null);
    setPhase("ingesting");
    start(async () => {
      try {
        const opts = { language, category, actions };

        // FILE MODE — upload each file, then poll its background job to completion.
        if (type.input === "file") {
          let anyOk = false;
          for (const item of runnable) {
            setItem(item.id, { status: "uploading", error: undefined, progress: 0 });
            const fd = new FormData();
            fd.append("file", item.file);
            fd.append("language", language);
            fd.append("category", category);
            fd.append("actions", JSON.stringify(actions));
            const r = await ingestFile(fd);
            if (!r.ok) { setItem(item.id, { status: "error", error: errorMessage(r, t) }); continue; }
            const done = await pollJob(r.jobId, (progress, phase) =>
              setItem(item.id, { status: phase === "done" ? "done" : "analyzing", progress }),
            );
            if (done.done) { setItem(item.id, { status: "done", chunks: done.chunks, progress: 100 }); anyOk = true; }
            else setItem(item.id, { status: "error", error: done.error });
          }
          setPhase("done");
          router.refresh();
          if (anyOk && actions.includes("posts")) router.push("/studio");
          return;
        }

        // URL / TEXT MODE — single item, then poll the job.
        let r: IngestResult;
        if (type.input === "url") r = await ingestUrl({ url, opts });
        else r = await ingestText({ text, title: t("pastedTitle"), opts });
        setRes(r);
        if (!r.ok) return setPhase("idle");
        setPhase("analyzing");
        const done = await pollJob(r.jobId, () => {});
        if (!done.done) { setRes({ ok: false, error: "failed", message: done.error }); return setPhase("idle"); }
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
            if (e.dataTransfer.files?.length && !pending) addFiles(e.dataTransfer.files);
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
          <input ref={inputRef} type="file" accept={type.accept} multiple hidden onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }} />
          <div style={{ width: 52, height: 52, margin: "0 auto", borderRadius: 14, display: "grid", placeItems: "center", background: "var(--teal-tint)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0-11 4 4m-4-4-4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="#0E9488" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockStart: 12, fontSize: 16 }}>{t("dropTitle")}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBlockStart: 6 }}>{t("dropHelper")} · {t("maxSize", { mb: nf.format(MAX_FILE_MB) })}</div>
          <span style={{ ...btnTeal, marginBlockStart: 14 }}>{t("pickFiles")}</span>
        </div>
      )}

      {/* Upload queue — independent per-file status */}
      {type.input === "file" && queue.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginBlockStart: 14 }}>
          {queue.map((it) => {
            const tone = it.status === "done" ? "var(--teal-deep)" : it.status === "error" || it.status === "toobig" ? "var(--coral)" : "var(--muted)";
            const statusText = it.status === "toobig" ? t("tooBigClient", { mb: nf.format(MAX_FILE_MB) })
              : it.status === "error" ? (it.error ?? t("ingestError"))
              : it.status === "uploading" ? t("qUploading")
              : it.status === "analyzing" ? t("qAnalyzing")
              : it.status === "done" ? t("qDone", { chunks: nf.format(it.chunks ?? 0) })
              : t("qQueued");
            const active = it.status === "uploading" || it.status === "analyzing";
            return (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "var(--card)", border: "1px solid var(--border)" }}>
                <FileTypeBadge label={(it.file.name.split(".").pop() ?? "TXT").toUpperCase()} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.file.name}</div>
                  <div style={{ fontSize: 11.5, color: tone, marginBlockStart: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    {active && <span className="skeleton" style={{ width: 10, height: 10, borderRadius: "50%" }} />}
                    {statusText}
                    <span style={{ color: "var(--subtle)", fontFamily: "var(--font-latin)" }}>· {(it.file.size / 1048576).toFixed(1)} MB</span>
                  </div>
                </div>
                {(it.status === "queued" || it.status === "toobig" || it.status === "error") && !pending && (
                  <button onClick={() => removeItem(it.id)} aria-label={t("removeFile")} style={{ flex: "none", width: 26, height: 26, borderRadius: 8, border: "none", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", fontSize: 15 }}>×</button>
                )}
                {it.status === "done" && <span style={{ color: "var(--teal-deep)", fontWeight: 800 }}>✓</span>}
              </div>
            );
          })}
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
          <div style={{ display: "flex", justifyContent: "flex-end", marginBlockStart: 6, fontSize: 12, fontWeight: 600, color: text.trim().length >= 150 ? "var(--teal-deep)" : "var(--muted)" }}>
            {t("charCount", { n: nf.format(text.trim().length), min: nf.format(150) })}
          </div>
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
                  setQueue([]);
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 18, marginBlockStart: 22 }}>
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
            {phase === "done" ? <StatusPill tone="teal" dot>{t("donePill")}</StatusPill> : <StatusPill tone="amber" dot>{phase === "analyzing" ? t("analyzingNow") : t("workingPill")}</StatusPill>}
          </div>
          <ProgressMeter
            pct={type.input === "file"
              ? Math.round((queue.filter((i) => i.status === "done").length / Math.max(1, queue.filter((i) => i.status !== "toobig").length)) * 100)
              : phase === "done" ? 100 : phase === "analyzing" ? 75 : 40}
            label={t("workingPill")}
          />
          {type.input === "file" && (
            <p style={{ marginBlockStart: 12, fontSize: 13.5, color: phase === "done" ? "var(--teal-deep)" : "var(--muted)", fontWeight: 600 }}>
              {t("queueSummary", { done: nf.format(queue.filter((i) => i.status === "done").length), total: nf.format(queue.filter((i) => i.status !== "toobig").length) })}
            </p>
          )}
          {type.input !== "file" && res && res.ok && phase === "done" && (
            <p style={{ marginBlockStart: 12, fontSize: 13.5, color: "var(--teal-deep)", fontWeight: 600 }}>
              {t("ingestDoneSimple")}
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
      case "no_storage": return t("tooStorage");
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
