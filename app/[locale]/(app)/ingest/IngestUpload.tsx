"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ingestFile, type IngestResult } from "./actions";

export function IngestUpload() {
  const t = useTranslations("Ingest");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<IngestResult | null>(null);
  const [name, setName] = useState("");
  const [drag, setDrag] = useState(false);

  const upload = (file: File) => {
    setName(file.name);
    setRes(null);
    if (file.size > 30 * 1024 * 1024) {
      setRes({ ok: false, error: "too_big" });
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    start(async () => {
      try {
        setRes(await ingestFile(fd));
      } catch (e) {
        setRes({ ok: false, error: "failed", message: e instanceof Error ? e.message : String(e) });
      }
    });
  };

  return (
    <div>
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
          if (f && !pending) upload(f);
        }}
        style={{
          border: `2px dashed ${drag ? "var(--teal)" : "var(--border-2)"}`,
          borderRadius: 16,
          padding: "34px 20px",
          textAlign: "center",
          background: drag ? "var(--teal-tint-2)" : "var(--surface)",
          cursor: pending ? "default" : "pointer",
          transition: "border-color .15s, background .15s",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/*,text/*,.txt,.md,.markdown,.csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <div style={{ width: 46, height: 46, margin: "0 auto", borderRadius: 12, display: "grid", placeItems: "center", background: "var(--teal-tint)" }}>
          {pending ? (
            <span
              style={{
                width: 20,
                height: 20,
                border: "2.5px solid rgba(14,148,136,.3)",
                borderTopColor: "#0E9488",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
              }}
            />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v11m0-11 4 4m-4-4-4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="#0E9488" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockStart: 12 }}>
          {pending ? t("uploading") : t("dropTitle")}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBlockStart: 6 }}>
          {pending && name ? name : t("dropHint")}
        </div>
        {pending && <div style={{ fontSize: 12, color: "var(--gold-dark)", marginBlockStart: 8 }}>{t("transcribingNote")}</div>}
      </div>

      {res && res.ok && (
        <p style={okStyle}>{t("ingestDone", { chunks: nf.format(res.chunks), total: nf.format(res.totalChunks) })}</p>
      )}
      {res && !res.ok && <p style={errStyle}>{errorMessage(res, t)}</p>}
    </div>
  );
}

function errorMessage(res: { error: string; message?: string }, t: (k: string) => string): string {
  const base = (() => {
    switch (res.error) {
      case "unsupported":
        return t("unsupported");
      case "too_big":
        return t("tooBig");
      case "no_transcribe_key":
        return t("needTranscribeKey");
      case "no_embed_key":
        return t("needEmbedKey");
      case "insufficient_credits":
        return t("insufficientCredits");
      case "no_session":
        return t("needSession");
      case "empty":
        return t("emptyExtract");
      default:
        return t("ingestError");
    }
  })();
  return res.message ? `${base} (${res.message})` : base;
}

const okStyle: React.CSSProperties = {
  marginBlockStart: 12,
  padding: "11px 14px",
  borderRadius: 12,
  background: "var(--teal-tint-2)",
  border: "1px solid rgba(20,184,166,.3)",
  color: "var(--teal-deep)",
  fontSize: 13.5,
  fontWeight: 600,
};

const errStyle: React.CSSProperties = {
  marginBlockStart: 12,
  padding: "11px 14px",
  borderRadius: 12,
  background: "var(--coral-tint)",
  border: "1px solid rgba(224,101,74,.3)",
  color: "var(--coral)",
  fontSize: 13.5,
};
