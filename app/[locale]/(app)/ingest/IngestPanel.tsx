"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { IngestText } from "./IngestText";
import { IngestUpload } from "./IngestUpload";
import { IngestUrl } from "./IngestUrl";

type Mode =
  | { key: string; kind: "file"; accept: string }
  | { key: string; kind: "paste" | "url" };

// Order matches the design's content-type chips (RTL).
const MODES: Mode[] = [
  { key: "video", kind: "file", accept: "video/*,audio/*" },
  { key: "audio", kind: "file", accept: "audio/*" },
  { key: "pdf", kind: "file", accept: "application/pdf,.pdf" },
  { key: "book", kind: "file", accept: "application/pdf,.pdf,.txt,.md" },
  { key: "doc", kind: "file", accept: ".txt,.md,.markdown,.csv,text/*,application/pdf,.pdf" },
  { key: "link", kind: "url" },
  { key: "posts", kind: "paste" },
];

export function IngestPanel() {
  const t = useTranslations("Ingest");
  const [modeKey, setModeKey] = useState("audio");
  const mode = MODES.find((m) => m.key === modeKey)!;

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 10 }}>
        {t("typesLabel")}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBlockEnd: 16 }}>
        {MODES.map((m) => {
          const on = m.key === modeKey;
          return (
            <button
              key={m.key}
              onClick={() => setModeKey(m.key)}
              style={{
                padding: "9px 15px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: on ? "1.5px solid var(--teal)" : "1.5px solid var(--border-2)",
                background: on ? "var(--teal-tint-2)" : "var(--card)",
                color: on ? "var(--navy)" : "var(--slate)",
              }}
            >
              {t(`mode_${m.key}`)}
            </button>
          );
        })}
      </div>

      {mode.kind === "paste" && <IngestText />}
      {mode.kind === "url" && <IngestUrl />}
      {mode.kind === "file" && <IngestUpload key={mode.key} accept={mode.accept} />}
    </div>
  );
}
