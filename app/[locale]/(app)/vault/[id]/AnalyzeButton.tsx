"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { analyzeSource, type AnalyzeResult } from "../actions";

export function AnalyzeButton({ sourceId, hasAnalysis }: { sourceId: string; hasAnalysis: boolean }) {
  const t = useTranslations("Analysis");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const run = () => {
    setErr(null);
    start(async () => {
      const r: AnalyzeResult = await analyzeSource(sourceId);
      if (r.ok) router.refresh();
      else
        setErr(
          r.error === "no_key"
            ? t("needKey")
            : r.error === "insufficient_credits"
              ? t("insufficientCredits")
              : r.error === "no_chunks"
                ? t("noChunks")
                : `${t("error")}${r.message ? ` (${r.message})` : ""}`,
        );
    });
  };

  return (
    <div>
      <button
        onClick={run}
        disabled={pending}
        style={{
          height: 44,
          padding: "0 22px",
          borderRadius: 12,
          border: "none",
          cursor: pending ? "default" : "pointer",
          background: "linear-gradient(135deg,#102A43,#0B1F33)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? t("analyzing") : hasAnalysis ? t("reanalyze") : t("analyzeNow")}
      </button>
      {err && <p style={{ marginBlockStart: 10, color: "var(--coral)", fontSize: 13.5 }}>{err}</p>}
    </div>
  );
}
