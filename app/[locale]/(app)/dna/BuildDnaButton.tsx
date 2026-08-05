"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { buildDna, jobStatus, pumpWorker } from "@/app/[locale]/(app)/ingest/actions";
import { btnNavy } from "@/components/ui/display";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Empty-state CTA for the DNA page. When the brand already has uploaded sources
 * we synthesize the DNA from them right here (enqueue + client-driven pump);
 * otherwise we send the user to upload their first source. */
export function BuildDnaButton({ hasSources, buildLabel, onboardLabel }: { hasSources: boolean; buildLabel: string; onboardLabel: string }) {
  const t = useTranslations("Dna");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  if (!hasSources) {
    return <Link href="/ingest" style={btnNavy}>{onboardLabel}</Link>;
  }

  const build = () =>
    start(async () => {
      setErr("");
      const r = await buildDna();
      if (!r.ok) {
        setErr(r.error === "insufficient_credits" ? t("errCredits") : r.error === "no_sources" ? t("errNoSources") : t("errGeneric"));
        return;
      }
      for (let i = 0; i < 200; i++) {
        await pumpWorker().catch(() => {}); // serverless has no always-on worker
        const s = await jobStatus(r.jobId);
        if (s.ok && s.status === "done") { router.refresh(); return; }
        if (s.ok && s.status === "dead") { setErr(t("errGeneric")); return; }
        await sleep(1500);
      }
      setErr(t("errTimeout"));
    });

  return (
    <div>
      <button onClick={build} disabled={pending} style={{ ...btnNavy, opacity: pending ? 0.75 : 1 }}>
        {pending ? t("building") : buildLabel}
      </button>
      {pending && <div style={{ marginBlockStart: 10, fontSize: 13, color: "var(--muted)" }}>{t("buildingHint")}</div>}
      {err && <div style={{ marginBlockStart: 10, fontSize: 13, color: "var(--coral)" }}>{err}</div>}
    </div>
  );
}
