"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ingestFile, ingestText, ingestUrl, jobStatus, type IngestResult } from "@/app/[locale]/(app)/ingest/actions";
import { FileTypeBadge, StatusPill, ProgressMeter, btnTeal, btnGhost } from "@/components/ui/display";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function pollJob(jobId: string): Promise<{ done: boolean; chunks?: number; error?: string }> {
  for (let i = 0; i < 200; i++) {
    const s = await jobStatus(jobId);
    if (s.ok) {
      if (s.status === "done") return { done: true, chunks: s.chunks };
      if (s.status === "dead") return { done: false, error: s.error ?? "failed" };
    }
    await sleep(1500);
  }
  return { done: false, error: "timeout" };
}

type Stage = "idle" | "working" | "done" | "error";
type Mode = null | "url" | "posts";

/** Design: dropzone + 3 entry buttons, a file-progress card, and the 4-step
 * analysis checklist with done/active/pending states. The checklist mirrors the
 * REAL pipeline stages we run (extract → tone → DNA → suggestions). */
export function Step3Form() {
  const t = useTranslations("Onboarding");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const [fileKind, setFileKind] = useState("TXT");
  const [sizeMb, setSizeMb] = useState<string | null>(null);
  const [res, setRes] = useState<IngestResult | null>(null);
  const [chunks, setChunks] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");

  const run = (fn: () => Promise<IngestResult>, name: string, kind: string, mb?: string) => {
    setFileName(name);
    setFileKind(kind);
    setSizeMb(mb ?? null);
    setRes(null);
    setChunks(null);
    setStage("working");
    start(async () => {
      try {
        const r = await fn();
        setRes(r);
        if (!r.ok) return setStage("error");
        const done = await pollJob(r.jobId); // wait for the real background pipeline
        if (done.done) { setChunks(done.chunks ?? null); setStage("done"); }
        else { setRes({ ok: false, error: "failed", message: done.error }); setStage("error"); }
      } catch (e) {
        setRes({ ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) });
        setStage("error");
      }
    });
  };

  const upload = (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const ext = file.name.split(".").pop()?.toUpperCase() ?? "TXT";
    run(() => ingestFile(fd), file.name, ext, (file.size / 1048576).toFixed(1));
  };

  // Checklist state derived from the real run.
  const KEYS = ["extract", "tone", "dna", "suggest"] as const;
  const steps: { key: string; state: "done" | "active" | "pending" }[] =
    stage === "done"
      ? KEYS.map((key) => ({ key, state: "done" as const }))
      : stage === "working"
        ? KEYS.map((key, i) => ({ key, state: i === 0 ? ("active" as const) : ("pending" as const) }))
        : KEYS.map((key) => ({ key, state: "pending" as const }));

  return (
    <>
      <h1 style={h1}>{t("s3Title")}</h1>
      <p style={sub}>{t("s3Sub")}</p>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !pending) upload(f);
        }}
        style={{
          marginBlockStart: 22,
          border: `2px dashed ${drag ? "var(--teal)" : "rgba(20,184,166,.45)"}`,
          borderRadius: 18,
          padding: "38px 20px",
          textAlign: "center",
          background: "linear-gradient(180deg,var(--teal-tint-2),var(--surface))",
        }}
      >
        <input ref={inputRef} type="file" accept="audio/*,video/*,text/*,.txt,.md,.csv,.pdf" hidden onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }} />
        <div style={{ width: 52, height: 52, margin: "0 auto", borderRadius: 14, display: "grid", placeItems: "center", background: "var(--card)", boxShadow: "0 1px 2px rgba(11,31,51,.06)" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0-11 4 4m-4-4-4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="#0E9488" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockStart: 12, fontSize: 16 }}>{t("s3Drop")}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBlockStart: 6, fontFamily: "var(--font-latin)" }}>{t("s3Formats")}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBlockStart: 16 }}>
          <button onClick={() => inputRef.current?.click()} disabled={pending} style={{ ...btnTeal, height: 42 }}>{t("s3Pick")}</button>
          <button onClick={() => setMode(mode === "url" ? null : "url")} style={{ ...btnGhost, height: 42 }}>{t("s3Url")}</button>
          <button onClick={() => setMode(mode === "posts" ? null : "posts")} style={{ ...btnGhost, height: 42 }}>{t("s3Posts")}</button>
        </div>

        {mode && (
          <div style={{ marginBlockStart: 16, textAlign: "start" }}>
            {mode === "url" ? (
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="https://example.com/article" dir="ltr" style={inp} />
            ) : (
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={t("s3PostsPh")} className="scb" style={{ ...inp, height: "auto", padding: 12, lineHeight: 1.8, resize: "vertical" }} />
            )}
            <button
              onClick={() =>
                mode === "url"
                  ? run(() => ingestUrl({ url: text }), text, "URL")
                  : run(() => ingestText({ text, title: t("s3PostsTitle") }), t("s3PostsTitle"), "TXT")
              }
              disabled={pending || !text.trim()}
              style={{ ...btnTeal, height: 42, marginBlockStart: 10, opacity: pending || !text.trim() ? 0.6 : 1 }}
            >
              {t("s3Analyze")}
            </button>
          </div>
        )}
      </div>

      {/* File / progress card */}
      {stage !== "idle" && (
        <div style={{ marginBlockStart: 18, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <FileTypeBadge label={fileKind} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: "var(--heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBlockStart: 6 }}>
                {stage === "working" && <StatusPill tone="amber" dot>{t("s3Analyzing")}</StatusPill>}
                {stage === "done" && <StatusPill tone="teal" dot>{t("s3Done")}</StatusPill>}
                {stage === "error" && <StatusPill tone="red" dot>{t("s3Failed")}</StatusPill>}
                {sizeMb && <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-latin)" }}>{sizeMb} MB</span>}
              </div>
            </div>
            {stage === "done" && res?.ok && (
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>100%</div>
            )}
          </div>
          <div style={{ marginBlockStart: 12 }}>
            <ProgressMeter pct={stage === "done" ? 100 : stage === "working" ? 55 : 0} />
          </div>

          {/* Analysis checklist */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 12, marginBlockStart: 16 }}>
            {steps.map((s) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    flex: "none",
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: s.state === "done" ? "var(--teal)" : "transparent",
                    border: s.state === "done" ? "none" : s.state === "active" ? "2px solid var(--gold)" : "1.5px solid var(--border-2)",
                  }}
                >
                  {s.state === "done" && <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  {s.state === "active" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)" }} />}
                </span>
                <span style={{ fontSize: 13.5, color: s.state === "done" ? "var(--slate)" : "var(--subtle)", fontWeight: s.state === "done" ? 600 : 500 }}>
                  {t(`s3_${s.key}`)}
                </span>
              </div>
            ))}
          </div>

          {stage === "done" && res?.ok && (
            <p style={{ marginBlockStart: 14, fontSize: 13.5, color: "var(--teal-deep)", fontWeight: 600 }}>
              {chunks != null ? t("s3Added", { chunks: nf.format(chunks) }) : t("s3AddedSimple")}
            </p>
          )}
          {stage === "error" && res && !res.ok && (
            <p style={{ marginBlockStart: 14, fontSize: 13.5, color: "var(--coral)" }}>{res.message ?? t("s3Failed")}</p>
          )}
        </div>
      )}

      <div style={{ height: 1, background: "var(--border)", marginBlock: "30px 20px" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button onClick={() => router.push("/dashboard")} style={{ ...btnTeal, height: 48, padding: "0 26px", fontSize: 14.5 }}>
          {t("s3Enter")} ←
        </button>
        <button onClick={() => router.push("/onboarding/2")} style={{ background: "none", border: "none", fontSize: 13.5, color: "var(--muted)", cursor: "pointer" }}>
          {t("back")}
        </button>
      </div>
    </>
  );
}

const h1: React.CSSProperties = { fontSize: "clamp(24px,3.4vw,30px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" };
const sub: React.CSSProperties = { fontSize: 15, color: "var(--muted)", lineHeight: 1.8, marginBlockStart: 8 };
const inp: React.CSSProperties = {
  width: "100%",
  height: 46,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid var(--border-2)",
  background: "var(--card)",
  fontSize: 14,
  outline: "none",
};
