import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ProcessingWatcher } from "@/components/ProcessingWatcher";
import { activeJobsCount } from "../ingest/actions";
import { CountUp } from "@/components/CountUp";
import {
  ScoreRadial,
  StatCard,
  StatusPill,
  FileTypeBadge,
  kindToLabel,
  CountBadge,
  IconTile,
  btnTeal,
  btnNavy,
} from "@/components/ui/display";

function relTime(from: Date, locale: string): string {
  const mins = Math.max(1, Math.round((Date.now() - from.getTime()) / 60000));
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" });
  if (mins < 60) return rtf.format(-mins, "minute");
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return rtf.format(-hrs, "hour");
  return rtf.format(-Math.round(hrs / 24), "day");
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dashboard");
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");

  let counts = { sources: 0, ideas: 0, drafts: 0, writing: 0, pending: 0, scheduled: 0, published: 0 };
  let completeness = 0;
  let ideas: Awaited<ReturnType<ReturnType<typeof forOrg>["listIdeas"]>> = [];
  let sources: Awaited<ReturnType<ReturnType<typeof forOrg>["listSources"]>> = [];
  let allSources: Awaited<ReturnType<ReturnType<typeof forOrg>["listSources"]>> = [];
  let scheduled: Awaited<ReturnType<ReturnType<typeof forOrg>["scheduledDrafts"]>> = [];
  let lastAnalysis: Date | null = null;
  let dnaDelta: number | null = null;
  let firstName = "";

  const supabase = await getSupabaseServer();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    const full = (data.user?.user_metadata?.full_name as string) || data.user?.email?.split("@")[0] || "";
    firstName = full.split(" ")[0];
  }
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const [c, dna, ii, ss, sc, la, dd] = await Promise.all([
        org.counts(ctx.brandId),
        org.currentDna(ctx.brandId),
        org.listIdeas(ctx.brandId, { limit: 3 }),
        org.listSources(ctx.brandId),
        org.scheduledDrafts(ctx.brandId),
        org.lastAnalysisAt(ctx.brandId),
        org.dnaCompletionDelta(ctx.brandId),
      ]);
      counts = c;
      completeness = dna?.completion_pct ?? 0;
      ideas = ii;
      allSources = ss;
      sources = ss.slice(0, 3);
      scheduled = sc;
      lastAnalysis = la;
      dnaDelta = dd;
    }
  }

  const awaiting = allSources.filter((s) => !s.analyzed && s.status !== "processing").length;
  const processing = allSources.filter((s) => s.status === "processing").length;

  // Next-best-action derived from real state.
  const rec =
    counts.sources === 0
      ? { body: t("recNoSources"), cta: t("recUpload"), href: "/ingest" }
      : completeness < 40
        ? { body: t("recBuildDna"), cta: t("recStudio"), href: "/studio" }
        : counts.drafts === 0
          ? { body: t("recWrite"), cta: t("recStudio"), href: "/studio" }
          : { body: t("recReview"), cta: t("recApprovals"), href: "/approvals" };

  const funnel = [
    { label: t("fIdeas"), n: counts.ideas, tint: "var(--gold-tint)", fg: "var(--gold-dark)", href: "/ideas" },
    { label: t("fWriting"), n: counts.writing, tint: "var(--blue-tint)", fg: "var(--blue)", href: "/studio" },
    { label: t("fReview"), n: counts.pending, tint: "var(--coral-tint)", fg: "var(--coral)", href: "/approvals" },
    { label: t("fScheduled"), n: counts.scheduled, tint: "var(--teal-tint-2)", fg: "var(--teal-deep)", href: "/calendar" },
    { label: t("fPublished"), n: counts.published, tint: "var(--border-3)", fg: "var(--slate-2)", href: "/analytics" },
  ];

  // This week strip (Sat → Fri), marking days that carry scheduled posts.
  const now = new Date();
  const dow = now.getDay(); // 0=Sun … 6=Sat
  const startOffset = (dow + 1) % 7; // days since Saturday
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - startOffset);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    const has = scheduled.some((s) => s.scheduledAt && sameDay(new Date(s.scheduledAt), d));
    return { d, has, today: sameDay(d, now) };
  });
  const weekCount = scheduled.filter((s) => s.scheduledAt && within(new Date(s.scheduledAt), week[0].d, week[6].d)).length;
  const weekdays = t("weekdays").split("،").map((s) => s.trim());

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      {processing > 0 && <ProcessingWatcher poll={activeJobsCount} />}
      {/* Greeting */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 className="headline-gradient" style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, letterSpacing: "-.4px" }}>
            {firstName ? t("greetingName", { name: firstName }) : t("greeting")} 👋
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--muted)", marginBlockStart: 6 }}>{t("subtitle")}</p>
        </div>
        {lastAnalysis && <StatusPill tone="teal" dot>{t("lastAnalysis", { when: relTime(lastAnalysis, locale) })}</StatusPill>}
      </div>

      {/* KPI row */}
      <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,168px),1fr))", gap: 14, marginBlockStart: 22 }}>
        <div style={{ background: "linear-gradient(160deg,#102A43,#0B1F33)", borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <ScoreRadial value={completeness} size={74} suffix="%" track="rgba(255,255,255,.14)" valueColor="#fff" label={t("kpiDna")} />
          <div>
            <div style={{ fontSize: 12.5, color: "#9FB3C8" }}>{t("kpiDna")}</div>
            {dnaDelta !== null && dnaDelta !== 0 ? (
              <div style={{ fontSize: 12, color: dnaDelta > 0 ? "var(--teal-light)" : "#F0A38A", fontWeight: 700, marginBlockStart: 4 }}>
                {dnaDelta > 0 ? "▲" : "▼"} {t("kpiDnaDelta", { n: nf.format(Math.abs(dnaDelta)) })}
              </div>
            ) : completeness > 0 ? (
              <div style={{ fontSize: 12, color: "var(--teal-light)", fontWeight: 700, marginBlockStart: 4 }}>{t("kpiDnaHint")}</div>
            ) : null}
          </div>
        </div>
        <StatCard label={t("kpiSources")} value={<CountUp value={counts.sources} locale={locale} />} tint="var(--blue-tint)" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7" stroke="var(--blue)" strokeWidth="1.7" /></svg>} />
        <StatCard label={t("kpiIdeas")} value={<CountUp value={counts.ideas} locale={locale} />} tint="var(--gold-tint)" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c.7.7 1 1.3 1 2h6c0-.7.3-1.3 1-2a6 6 0 0 0-4-10z" stroke="var(--gold-dark)" strokeWidth="1.7" strokeLinecap="round" /></svg>} />
        <StatCard label={t("kpiPending")} value={<CountUp value={counts.pending} locale={locale} />} tint="var(--coral-tint)" note={counts.pending > 0 ? t("needsAction") : undefined} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7z" stroke="var(--coral)" strokeWidth="1.7" strokeLinejoin="round" /></svg>} />
        <StatCard label={t("kpiScheduled")} value={<CountUp value={counts.scheduled} locale={locale} />} tint="var(--teal-tint)" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9h16" stroke="var(--teal-deep)" strokeWidth="1.7" /></svg>} />
      </div>

      {/* Recommendation hero */}
      <div style={{ marginBlockStart: 20, background: "linear-gradient(160deg,#102A43,#0B1F33)", color: "#fff", borderRadius: 18, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBlockEnd: 10 }}>
          <IconTile tint="rgba(20,184,166,.18)" size={30} radius={9}><span style={{ color: "var(--teal-light)", fontSize: 14 }}>✦</span></IconTile>
          <span style={{ fontSize: 12.5, color: "var(--teal-light)", fontWeight: 700 }}>{t("recTitle")}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.8, marginBlockEnd: 18, maxWidth: 720 }}>{rec.body}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={rec.href} style={btnTeal}>{rec.cta}</Link>
          <Link href="/dna" style={{ ...btnNavy, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)" }}>{t("recDetails")}</Link>
        </div>
      </div>

      <div className="col2 wide-first" style={{ marginBlockStart: 20 }}>
        {/* MAIN column */}
        <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
          {/* Pipeline */}
          <section style={card}>
            <div style={cardHead}>
              <span style={cardTitle}>{t("pipeline")}</span>
              <Link href="/approvals" style={linkSm}>{t("viewAll")}</Link>
            </div>
            <div style={{ display: "flex", alignItems: "stretch", gap: 6, flexWrap: "wrap" }}>
              {funnel.map((f, i) => (
                <div key={f.label} style={{ display: "contents" }}>
                  <Link href={f.href} style={{ flex: "1 1 90px", minWidth: 84, background: f.tint, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: f.fg, fontFamily: "var(--font-latin)" }}>{nf.format(f.n)}</div>
                    <div style={{ fontSize: 11.5, color: "var(--slate-2)", marginBlockStart: 3 }}>{f.label}</div>
                  </Link>
                  {i < funnel.length - 1 && (
                    <span style={{ alignSelf: "center", color: "var(--subtle)", fontSize: 13 }}>‹</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Suggested content */}
          <section style={card}>
            <div style={cardHead}>
              <span style={cardTitle}>{t("suggested")}</span>
              {ideas.length > 0 && <StatusPill tone="teal">{t("ideasCount", { n: nf.format(ideas.length) })}</StatusPill>}
            </div>
            {ideas.length === 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                <Link href="/ingest" style={qa}>{t("qaUpload")}</Link>
                <Link href="/ideas" style={qa}>{t("qaIdeas")}</Link>
                <Link href="/studio" style={qa}>{t("qaStudio")}</Link>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {ideas.map((i) => (
                  <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <IconTile tint="var(--gold-tint)" size={34}>💡</IconTile>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBlockStart: 3, fontFamily: "var(--font-latin)" }}>Post Score {nf.format(i.postScore)}</div>
                    </div>
                    <Link href="/studio" style={{ ...btnNavy, height: 34, padding: "0 15px", fontSize: 12.5 }}>{t("write")}</Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* SIDE column */}
        <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
          {/* Quick actions */}
          <section style={card}>
            <div style={{ ...cardTitle, marginBlockEnd: 14 }}>{t("quickActions")}</div>
            <div style={{ display: "grid", gap: 8 }}>
              <QuickAction href="/ingest" label={t("qaUpload")} />
              <QuickAction href="/studio" label={t("qaStudio")} />
              <QuickAction href="/ideas" label={t("qaIdeas")} />
              <QuickAction href="/approvals" label={t("qaApprovals")} badge={counts.pending || undefined} />
            </div>
          </section>

          {/* Processing — sources whose background ingest job is running */}
          {processing > 0 && (
            <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
              <span className="skeleton" style={{ flex: "none", width: 40, height: 40, borderRadius: 11 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--heading)" }}>{t("processingTitle", { n: nf.format(processing) })}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBlockStart: 2 }}>{t("processingBody")}</div>
              </div>
            </div>
          )}

          {/* Awaiting analysis — sources uploaded but not yet analyzed */}
          {awaiting > 0 && (
            <Link href="/vault" style={{ ...card, display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
              <span style={{ flex: "none", display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 11, background: "var(--gold-tint)", color: "var(--gold-dark)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--heading)" }}>{t("awaitingTitle", { n: nf.format(awaiting) })}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBlockStart: 2 }}>{t("awaitingBody")}</div>
              </div>
              <span style={{ color: "var(--subtle)" }}>‹</span>
            </Link>
          )}

          {/* Latest files */}
          <section style={card}>
            <div style={cardHead}>
              <span style={cardTitle}>{t("latestFiles")}</span>
              <Link href="/vault" style={linkSm}>{t("vaultLink")}</Link>
            </div>
            {sources.length === 0 ? (
              <p style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t("noFiles")}</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {sources.map((s) => (
                  <Link key={s.id} href={`/vault/${s.id}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FileTypeBadge label={kindToLabel(s.kind, s.title)} size={30} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title || t("untitled")}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: s.analyzed ? "var(--teal-deep)" : "var(--gold-dark)", marginBlockStart: 2 }}>
                        {s.analyzed ? t("fileAnalyzed", { n: nf.format(s.chunks) }) : t("fileNeedsAnalysis")}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* This week */}
          <section style={card}>
            <div style={cardHead}>
              <span style={cardTitle}>{t("thisWeek")}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("weekPosts", { n: nf.format(weekCount) })}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
              {week.map((w, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--subtle)", marginBlockEnd: 5 }}>{weekdays[i]}</div>
                  <div
                    style={{
                      height: 44,
                      borderRadius: 10,
                      display: "grid",
                      placeItems: "center",
                      gap: 3,
                      background: w.has ? "var(--teal-tint-2)" : "var(--surface)",
                      border: w.today ? "1.5px solid var(--teal)" : "1px solid var(--border)",
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: w.today ? "var(--teal-deep)" : "var(--slate)", fontFamily: "var(--font-latin)" }}>{w.d.getDate()}</span>
                    {w.has && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--teal)" }} />}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function QuickAction({ href, label, badge }: { href: string; label: string; badge?: number }) {
  return (
    <Link href={href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "11px 13px", borderRadius: 11, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13.5, fontWeight: 600, color: "var(--slate)" }}>
      {label}
      {badge ? <CountBadge n={badge} /> : <span style={{ color: "var(--subtle)" }}>‹</span>}
    </Link>
  );
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function within(d: Date, a: Date, b: Date) {
  return d >= new Date(a.getFullYear(), a.getMonth(), a.getDate()) && d <= new Date(b.getFullYear(), b.getMonth(), b.getDate(), 23, 59, 59);
}

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 };
const cardHead: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBlockEnd: 14 };
const cardTitle: React.CSSProperties = { fontWeight: 700, color: "var(--heading)", fontSize: 15 };
const linkSm: React.CSSProperties = { fontSize: 12.5, color: "var(--teal-deep)", fontWeight: 600 };
const qa: React.CSSProperties = { display: "block", padding: "12px 14px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 14, fontWeight: 600, color: "var(--slate)" };
