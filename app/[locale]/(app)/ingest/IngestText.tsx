"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ingestText, type IngestResult } from "./actions";

const field: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--border-2)",
  background: "var(--card)",
  fontSize: 14,
  outline: "none",
};

export function IngestText() {
  const t = useTranslations("Ingest");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [res, setRes] = useState<IngestResult | null>(null);

  const submit = () => {
    setRes(null);
    start(async () => setRes(await ingestText({ title, text })));
  };

  return (
    <section
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 18,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 10 }}>
        {t("textTitle")}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("titlePlaceholder")}
        style={{ ...field, marginBlockEnd: 10 }}
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("textPlaceholder")}
        className="scb"
        rows={7}
        style={{ ...field, resize: "vertical", lineHeight: 1.8 }}
      />
      <button
        onClick={submit}
        disabled={pending}
        style={{
          marginBlockStart: 12,
          width: "100%",
          height: 46,
          borderRadius: 12,
          border: "none",
          cursor: pending ? "default" : "pointer",
          background: "linear-gradient(135deg,#102A43,#0B1F33)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14.5,
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? t("ingesting") : t("ingestBtn")}
      </button>

      {res && res.ok && (
        <p
          style={{
            marginBlockStart: 12,
            padding: "11px 14px",
            borderRadius: 12,
            background: "var(--teal-tint-2)",
            border: "1px solid rgba(20,184,166,.3)",
            color: "var(--teal-deep)",
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          {t("ingestDone", { chunks: nf.format(res.chunks), total: nf.format(res.totalChunks) })}
        </p>
      )}
      {res && !res.ok && (
        <p
          style={{
            marginBlockStart: 12,
            padding: "11px 14px",
            borderRadius: 12,
            background: "var(--coral-tint)",
            border: "1px solid rgba(224,101,74,.3)",
            color: "var(--coral)",
            fontSize: 13.5,
          }}
        >
          {res.error === "too_few"
            ? t("needText")
            : res.error === "no_embed_key"
              ? t("needEmbedKey")
              : res.error === "insufficient_credits"
                ? t("insufficientCredits")
                : res.error === "no_session"
                  ? t("needSession")
                  : `${t("ingestError")}${res.message ? ` (${res.message})` : ""}`}
        </p>
      )}
    </section>
  );
}
