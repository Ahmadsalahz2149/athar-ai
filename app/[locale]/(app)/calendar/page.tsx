import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { platformColor, btnTeal } from "@/components/ui/display";
import { Scheduler } from "./Scheduler";

export default async function CalendarPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ym?: string }> }) {
  const { locale } = await params;
  const { ym } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Calendar");
  const tf = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { hour: "numeric", minute: "2-digit" });

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

  const byDay = new Map<number, { hook: string; platform: string; time: string }[]>();
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
        if (dt.getFullYear() === year && dt.getMonth() === month) {
          const arr = byDay.get(dt.getDate()) ?? [];
          arr.push({ hook: r.hook, platform: r.platform, time: tf.format(dt) });
          byDay.set(dt.getDate(), arr);
        }
      }
      unscheduled = approved.map((r) => ({ id: r.id, hook: r.hook }));
    }
  }

  const weekdays = t("weekdays").split("،").map((s) => s.trim());
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
            <span style={{ padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, background: "var(--navy)", color: "#fff" }}>{t("monthly")}</span>
            <span style={{ padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{t("weekly")}</span>
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

        {/* Left column: month grid */}
        <section style={{ ...card, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBlockEnd: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link href={`/calendar?ym=${prevYm}`} aria-label={t("prevMonth")} style={navBtn}>‹</Link>
              <span style={{ fontWeight: 700, color: "var(--heading)", fontSize: 17, minWidth: 130, textAlign: "center" }}>{monthName}</span>
              <Link href={`/calendar?ym=${nextYm}`} aria-label={t("nextMonth")} style={navBtn}>›</Link>
              {!isCurrentMonth && <Link href="/calendar" style={{ fontSize: 12, fontWeight: 600, color: "var(--teal-deep)", marginInlineStart: 4 }}>{t("todayBtn")}</Link>}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--teal-deep)", padding: "5px 11px", borderRadius: 999, background: "var(--teal-tint-2)" }}>✦ {t("bestTimes")}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
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
        </section>
      </div>
    </main>
  );
}

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 };
const cardTitle: React.CSSProperties = { fontWeight: 700, color: "var(--heading)", fontSize: 15 };
const navBtn: React.CSSProperties = { display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--slate)", fontSize: 18, fontWeight: 700, lineHeight: 1, textDecoration: "none" };
