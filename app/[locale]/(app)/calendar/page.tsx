import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { platformColor, btnTeal } from "@/components/ui/display";
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

  type Item = { hook: string; platform: string; time: string; sort: number };
  const byDay = new Map<number, Item[]>();
  const byDate = new Map<string, Item[]>();
  let unscheduled: { id: string; hook: string }[] = [];
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const [sched, approved] = await Promise.all([
        org.scheduledDrafts(ctx.brandId),
        org.listDraftsByStatus(ctx.brandId, "approved"),
      ]);
      for (const r of sched) {
        if (!r.scheduledAt) continue;
        const dt = new Date(r.scheduledAt);
        const item: Item = { hook: r.hook, platform: r.platform, time: tf.format(dt), sort: dt.getHours() * 60 + dt.getMinutes() };
        if (dt.getFullYear() === year && dt.getMonth() === month) {
          const arr = byDay.get(dt.getDate()) ?? [];
          arr.push(item);
          byDay.set(dt.getDate(), arr);
        }
        const key = iso(dt);
        const darr = byDate.get(key) ?? [];
        darr.push(item);
        byDate.set(key, darr);
      }
      unscheduled = approved.map((r) => ({ id: r.id, hook: r.hook }));
    }
  }
  for (const arr of byDate.values()) arr.sort((a, b) => a.sort - b.sort);

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
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--teal-deep)", padding: "5px 11px", borderRadius: 999, background: "var(--teal-tint-2)" }}>✦ {t("bestTimes")}</span>
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
                          items.map((p, j) => (
                            <div key={j} title={p.hook} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "5px 9px", borderRadius: 8, background: "var(--card)", borderInlineStart: `3px solid ${platformColor(p.platform)}` }}>
                              <span style={{ fontFamily: "var(--font-latin)", color: "var(--muted)", flex: "none", fontSize: 11.5 }}>{p.time}</span>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--slate)" }}>{p.hook}</span>
                            </div>
                          ))
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
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--teal-deep)", padding: "5px 11px", borderRadius: 999, background: "var(--teal-tint-2)" }}>✦ {t("bestTimes")}</span>
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
                          {(byDay.get(d) ?? []).map((p, j) => (
                            <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "5px 9px", borderRadius: 8, background: "var(--card)", borderInlineStart: `3px solid ${platformColor(p.platform)}` }}>
                              <span style={{ fontFamily: "var(--font-latin)", color: "var(--muted)", flex: "none", fontSize: 11.5 }}>{p.time}</span>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--slate)" }}>{p.hook}</span>
                            </div>
                          ))}
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
                          {(byDay.get(d) ?? []).slice(0, 3).map((p, j) => (
                            <div key={j} title={p.hook} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9.5, padding: "2px 5px", borderRadius: 5, background: "var(--surface)", borderInlineStart: `2px solid ${platformColor(p.platform)}`, overflow: "hidden" }}>
                              <span style={{ fontFamily: "var(--font-latin)", color: "var(--muted)", flex: "none" }}>{p.time}</span>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--slate)" }}>{p.hook}</span>
                            </div>
                          ))}
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

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 };
const cardTitle: React.CSSProperties = { fontWeight: 700, color: "var(--heading)", fontSize: 15 };
const navBtn: React.CSSProperties = { display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--slate)", fontSize: 18, fontWeight: 700, lineHeight: 1, textDecoration: "none" };
