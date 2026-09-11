import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { platformColor, btnTeal } from "@/components/ui/display";
import { toPlatformId } from "@/lib/social/registry";
import { Scheduler } from "./Scheduler";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function CalendarPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ym?: string; view?: string; wk?: string }> }) {
  const { locale } = await params;
  const { ym, view, wk } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Calendar");
  const tf = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { hour: "numeric", minute: "2-digit" });
  const isWeek = view === "week";

  const now = new Date();
  // Which month to show — from ?ym=YYYY-M, else the current month. "today" is only
  // highlighted when the shown month is the real current month.
  const parsed = ym && /^\d{4}-\d{1,2}$/.test(ym) ? ym.split("-").map(Number) : null;
  const year = parsed ? parsed[0] : now.getFullYear();
  const month = parsed ? Math.min(11, Math.max(0, parsed[1])) : now.getMonth();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const today = isCurrentMonth ? now.getDate() : -1;
  const startWeekday = (new Date(year, month, 1).getDay() + 1) % 7; // days after Saturday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { month: "long", year: "numeric" }).format(new Date(year, month, 1));
  const prevYm = month === 0 ? `${year - 1}-11` : `${year}-${month - 1}`;
  const nextYm = month === 11 ? `${year + 1}-0` : `${year}-${month + 1}`;
  const defaultWhen = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T10:00`;

  // Week view anchor: the Saturday of the shown week (from ?wk=ISO, else this week).
  const wkAnchor = wk && /^\d{4}-\d{2}-\d{2}$/.test(wk) ? new Date(`${wk}T00:00:00`) : now;
  const weekStart = new Date(wkAnchor.getFullYear(), wkAnchor.getMonth(), wkAnchor.getDate() - ((wkAnchor.getDay() + 1) % 7));
  const weekDates = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));
  const prevWk = iso(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7));
  const nextWk = iso(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7));

  type Item = { hook: string; platform: string; time: string; sort: number; state: PostState; url: string | null; error: string | null };
  const byDay = new Map<number, Item[]>();
  const byDate = new Map<string, Item[]>();
  let unscheduled: { id: string; hook: string; platform: string; canPublish: boolean }[] = [];
  let connected: string[] = [];
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      // The calendar now shows the whole life of a post, not just its plan:
      // waiting → going out → live (with a link) → failed (with the reason).
      const [sched, approved, published, publishing, failed, conns] = await Promise.all([
        org.scheduledDrafts(ctx.brandId),
        org.listDraftsByStatus(ctx.brandId, "approved"),
        org.publishedDrafts(ctx.brandId),
        org.listDraftsByStatus(ctx.brandId, "publishing"),
        org.listDraftsByStatus(ctx.brandId, "publish_failed"),
        org.listConnections(ctx.brandId),
      ]);
      connected = conns.filter((c) => c.status === "connected").map((c) => c.platform);

      const place = (r: { hook: string; platform: string; scheduledAt: Date | null; publishedAt?: Date | null; externalUrl?: string | null; publishError?: string | null }, state: PostState) => {
        // A published post is pinned to when it actually went out; everything
        // else to when it is meant to.
        const at = (state === "published" ? r.publishedAt : null) ?? r.scheduledAt;
        if (!at) return;
        const dt = new Date(at);
        const item: Item = {
          hook: r.hook, platform: r.platform, time: tf.format(dt),
          sort: dt.getHours() * 60 + dt.getMinutes(), state,
          url: r.externalUrl ?? null, error: r.publishError ?? null,
        };
        if (dt.getFullYear() === year && dt.getMonth() === month) {
          const arr = byDay.get(dt.getDate()) ?? [];
          arr.push(item);
          byDay.set(dt.getDate(), arr);
        }
        const key = iso(dt);
        const darr = byDate.get(key) ?? [];
        darr.push(item);
        byDate.set(key, darr);
      };

      for (const r of sched) place(r, "scheduled");
      for (const r of publishing) place(r, "publishing");
      for (const r of published) place(r, "published");
      for (const r of failed) place(r, "failed");

      unscheduled = approved.map((r) => ({
        id: r.id, hook: r.hook, platform: r.platform,
        // "Publish now" is only offered when there is an account to publish to.
        canPublish: Boolean(toPlatformId(r.platform) && connected.includes(toPlatformId(r.platform)!)),
      }));
    }
  }
  for (const arr of byDate.values()) arr.sort((a, b) => a.sort - b.sort);

  const stateLabels: Record<PostState, string> = {
    scheduled: t("stScheduled"), publishing: t("stPublishing"), published: t("stPublished"), failed: t("stFailed"),
  };
  const weekdays = t("weekdays").split("،").map((s) => s.trim());
  const weekRangeLabel = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { day: "numeric", month: "short" }).formatRange(weekDates[0], weekDates[6]);
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
          <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.7, marginBlockStart: 6 }}>{t("subtitle")}</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", padding: 3, borderRadius: 999, background: "var(--card)", border: "1px solid var(--border-2)" }}>
            <Link href="/calendar" style={{ padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: isWeek ? 600 : 700, background: isWeek ? "transparent" : "var(--navy)", color: isWeek ? "var(--muted)" : "#fff" }}>{t("monthly")}</Link>
            <Link href="/calendar?view=week" style={{ padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: isWeek ? 700 : 600, background: isWeek ? "var(--teal)" : "transparent", color: isWeek ? "#fff" : "var(--muted)" }}>{t("weekly")}</Link>
          </div>
          <Link href="/studio" style={btnTeal}>+ {t("schedulePost")}</Link>
        </div>
      </div>

      <div className="col2 legend-first" style={{ marginBlockStart: 22 }}>
        {/* Right column: legend + unscheduled */}
        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <section style={card}>
            <div style={cardTitle}>{t("platforms")}</div>
            <div style={{ display: "grid", gap: 10, marginBlockStart: 12 }}>
              {["LinkedIn", "X / Twitter", "Instagram"].map((p) => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--slate)" }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: platformColor(p) }} />
                  {p}
                </div>
              ))}
            </div>
          </section>

          <Scheduler
            items={unscheduled}
            defaultWhen={defaultWhen}
            labels={{
              unscheduled: t("unscheduled"), none: t("noUnscheduled"), scheduleBtn: t("scheduleBtn"),
              confirm: t("confirmSchedule"), cancel: t("cancel"), autoAll: t("autoScheduleAll"),
              scheduling: t("scheduling"), pickWhen: t("pickWhen"), autoDone: t("autoScheduled"), error: t("scheduleError"),
              publishNow: t("publishNow"), publishSent: t("publishSent"), notConnected: t("publishNotConnected"),
            }}
          />
        </div>

        {/* Left column: month grid OR week agenda */}
        <section style={{ ...card, padding: 18 }}>
          {isWeek ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBlockEnd: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Link href={`/calendar?view=week&wk=${prevWk}`} aria-label={t("prevWeek")} style={navBtn}>‹</Link>
                  <span style={{ fontWeight: 700, color: "var(--heading)", fontSize: 16, minWidth: 130, textAlign: "center" }}>{weekRangeLabel}</span>
                  <Link href={`/calendar?view=week&wk=${nextWk}`} aria-label={t("nextWeek")} style={navBtn}>›</Link>
                  <Link href="/calendar?view=week" style={{ fontSize: 12, fontWeight: 600, color: "var(--teal-deep)", marginInlineStart: 4 }}>{t("thisWeekBtn")}</Link>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--teal-deep)", padding: "5px 11px", borderRadius: 999, background: "var(--teal-tint-2)" }}>{t("bestTimes")}</span>
              </div>
              {/* Agenda: one row per day (stacks naturally on mobile) */}
              <div style={{ display: "grid", gap: 8 }}>
                {weekDates.map((d, i) => {
                  const items = byDate.get(iso(d)) ?? [];
                  const isToday = iso(d) === iso(now);
                  return (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "stretch", padding: "10px 12px", borderRadius: 12, background: isToday ? "var(--teal-tint-2)" : "var(--surface)", border: isToday ? "1.5px solid var(--teal)" : "1px solid var(--border)" }}>
                      <div style={{ flex: "none", width: 52, textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{weekdays[i]}</div>
                        <div style={{ fontSize: 19, fontWeight: 800, color: isToday ? "var(--teal-deep)" : "var(--heading)", fontFamily: "var(--font-latin)" }}>{d.getDate()}</div>
                      </div>
                      <div style={{ flex: 1, display: "grid", gap: 5, alignContent: "center", borderInlineStart: "1px solid var(--border)", paddingInlineStart: 12 }}>
                        {items.length === 0 ? (
                          <span style={{ fontSize: 12.5, color: "var(--subtle)" }}>{t("noPostsDay")}</span>
                        ) : (
                          items.map((p, j) => <PostChip key={j} p={p} labels={stateLabels} />)
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBlockEnd: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Link href={`/calendar?ym=${prevYm}`} aria-label={t("prevMonth")} style={navBtn}>‹</Link>
                  <span style={{ fontWeight: 700, color: "var(--heading)", fontSize: 17, minWidth: 130, textAlign: "center" }}>{monthName}</span>
                  <Link href={`/calendar?ym=${nextYm}`} aria-label={t("nextMonth")} style={navBtn}>›</Link>
                  {!isCurrentMonth && <Link href="/calendar" style={{ fontSize: 12, fontWeight: 600, color: "var(--teal-deep)", marginInlineStart: 4 }}>{t("todayBtn")}</Link>}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--teal-deep)", padding: "5px 11px", borderRadius: 999, background: "var(--teal-tint-2)" }}>{t("bestTimes")}</span>
              </div>

              {/* Phones: a day agenda instead of the 7-column grid (unreadable at 375px) */}
              <div className="cal-agenda" style={{ gap: 8 }}>
                {cells.filter((d): d is number => d !== null && (byDay.get(d)?.length ?? 0) > 0).length === 0 ? (
                  <p style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", padding: "18px 0" }}>{t("noPostsMonth")}</p>
                ) : (
                  cells
                    .filter((d): d is number => d !== null && (byDay.get(d)?.length ?? 0) > 0)
                    .map((d) => (
                      <div key={d} style={{ display: "flex", gap: 12, padding: "10px 12px", borderRadius: 12, background: d === today ? "var(--teal-tint-2)" : "var(--surface)", border: d === today ? "1.5px solid var(--teal)" : "1px solid var(--border)" }}>
                        <div style={{ flex: "none", width: 40, textAlign: "center" }}>
                          <div style={{ fontSize: 19, fontWeight: 800, color: d === today ? "var(--teal-deep)" : "var(--heading)", fontFamily: "var(--font-latin)" }}>{d}</div>
                        </div>
                        <div style={{ flex: 1, display: "grid", gap: 5, borderInlineStart: "1px solid var(--border)", paddingInlineStart: 12 }}>
                          {(byDay.get(d) ?? []).map((p, j) => <PostChip key={j} p={p} labels={stateLabels} />)}
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div className="cal-month" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
                {weekdays.map((w, i) => (
                  <div key={i} style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", padding: "6px 0" }}>{w}</div>
                ))}
                {cells.map((d, i) => (
                  <div key={i} style={{ minHeight: 96, borderRadius: 11, border: "1px solid var(--border)", background: d === null ? "transparent" : d === today ? "var(--teal-tint-2)" : "var(--card)", padding: 7 }}>
                    {d !== null && (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: d === today ? "var(--teal-deep)" : "var(--slate)", fontFamily: "var(--font-latin)" }}>{d}</div>
                        <div style={{ display: "grid", gap: 3, marginBlockStart: 5 }}>
                          {(byDay.get(d) ?? []).slice(0, 3).map((p, j) => <PostChip key={j} p={p} labels={stateLabels} compact />)}
                          {(byDay.get(d)?.length ?? 0) > 3 && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--teal-deep)", paddingInlineStart: 5 }}>{t("moreCount", { n: (byDay.get(d)!.length - 3) })}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

type PostState = "scheduled" | "publishing" | "published" | "failed";

/** One post on a day. The dot carries the *publishing* state (waiting, going
 * out, live, failed) while the leading bar stays the platform colour, so the
 * calendar reads the same as before at a glance and gains a second dimension
 * only when you look closer. A live post links to itself. */
function PostChip({ p, labels, compact = false }: { p: { hook: string; platform: string; time: string; state: PostState; url: string | null; error: string | null }; labels: Record<PostState, string>; compact?: boolean }) {
  const size = compact ? { fontSize: 9.5, padding: "2px 5px", radius: 5, bar: 2, gap: 4, dot: 5 } : { fontSize: 12.5, padding: "5px 9px", radius: 8, bar: 3, gap: 8, dot: 7 };
  const title = `${labels[p.state]} — ${p.hook}${p.error ? `\n${p.error}` : ""}`;
  const inner = (
    <>
      <span aria-hidden style={{ flex: "none", width: size.dot, height: size.dot, borderRadius: "50%", background: STATE_COLOR[p.state], border: p.state === "scheduled" ? "1px solid var(--border-2)" : "none" }} />
      <span style={{ fontFamily: "var(--font-latin)", color: "var(--muted)", flex: "none", fontSize: compact ? undefined : 11.5 }}>{p.time}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--slate)", textDecoration: p.state === "published" && p.url ? "underline" : "none" }}>{p.hook}</span>
    </>
  );
  const style: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: size.gap, fontSize: size.fontSize,
    padding: size.padding, borderRadius: size.radius,
    background: compact ? "var(--surface)" : "var(--card)",
    borderInlineStart: `${size.bar}px solid ${platformColor(p.platform)}`,
    overflow: "hidden", opacity: p.state === "failed" ? 0.75 : 1,
    color: "inherit", textDecoration: "none",
  };
  return p.state === "published" && p.url ? (
    <a href={p.url} target="_blank" rel="noopener noreferrer" title={title} style={style}>{inner}</a>
  ) : (
    <div title={title} style={style}>{inner}</div>
  );
}

const STATE_COLOR: Record<PostState, string> = {
  scheduled: "var(--border-2)",
  publishing: "var(--gold)",
  published: "var(--teal)",
  failed: "var(--coral)",
};

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 };
const cardTitle: React.CSSProperties = { fontWeight: 700, color: "var(--heading)", fontSize: 15 };
const navBtn: React.CSSProperties = { display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--slate)", fontSize: 18, fontWeight: 700, lineHeight: 1, textDecoration: "none" };
