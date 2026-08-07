import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { activeJobsCount } from "../ingest/actions";
import { ProcessingWatcher } from "@/components/ProcessingWatcher";
import { StatusPill, EmptyState, GlyphIcon } from "@/components/ui/display";
import { RetryButton } from "./RetryButton";

export const dynamic = "force-dynamic";

type Job = {
  id: string;
  type: string;
  status: string;
  progress: number;
  phase: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const TYPE_GLYPH: Record<string, string> = { ingest_source: "bookOpen", analyze_source: "chart", synthesize_dna: "bulb" };

function relTime(from: Date, locale: string): string {
  const mins = Math.max(0, Math.round((Date.now() - from.getTime()) / 60000));
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" });
  if (mins < 1) return rtf.format(0, "minute");
  if (mins < 60) return rtf.format(-mins, "minute");
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return rtf.format(-hrs, "hour");
  return rtf.format(-Math.round(hrs / 24), "day");
}

export default async function ActivityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Activity");

  let jobs: Job[] = [];
  let active = 0;
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      jobs = await forOrg(db, ctx.orgId).recentJobs(ctx.brandId, 40);
      active = jobs.filter((j) => j.status === "queued" || j.status === "running").length;
    }
  }

  const statusTone = (s: string): "teal" | "amber" | "red" | "neutral" =>
    s === "done" ? "teal" : s === "running" || s === "queued" ? "amber" : s === "dead" || s === "failed" ? "red" : "neutral";

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      {active > 0 && <ProcessingWatcher poll={activeJobsCount} />}
      <h1 className="headline-gradient" style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", marginBlock: "6px 20px" }}>{t("subtitle")}</p>

      {active > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, background: "var(--gold-tint)", color: "var(--gold-dark)", fontSize: 13, fontWeight: 600, marginBlockEnd: 16 }}>
          <span className="skeleton" style={{ width: 16, height: 16, borderRadius: "50%", flex: "none" }} />
          {t("running", { n: active })}
        </div>
      )}

      {jobs.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {jobs.map((j) => (
            <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", flexWrap: "wrap" }}>
              <span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, background: "var(--teal-tint,#e6f7f4)", color: "var(--teal)", flexShrink: 0 }}>
                <GlyphIcon name={TYPE_GLYPH[j.type] ?? "chart"} size={19} />
              </span>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--heading)" }}>{t(`type_${j.type}`)}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginBlockStart: 2 }}>
                  {relTime(j.createdAt, locale)}
                  {j.status === "running" && j.phase ? ` · ${j.phase} ${j.progress}%` : ""}
                  {(j.status === "failed" || j.status === "dead") && j.lastError ? ` · ${j.lastError.slice(0, 60)}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {(j.status === "failed" || j.status === "dead") && <RetryButton jobId={j.id} />}
                <StatusPill tone={statusTone(j.status)} dot>{t(`status_${j.status}`)}</StatusPill>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
