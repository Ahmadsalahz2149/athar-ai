import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { platformColor, CountBadge, btnTeal } from "@/components/ui/display";

export default async function CalendarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Calendar");
  const tf = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { hour: "numeric", minute: "2-digit" });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const startWeekday = (new Date(year, month, 1).getDay() + 1) % 7; // days after Saturday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { month: "long", year: "numeric" }).format(now);

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

      <div className="col-2" style={{ marginBlockStart: 22, gridTemplateColumns: "1fr 2.4fr" }}>
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

          <section style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBlockEnd: 12 }}>
              <span style={cardTitle}>{t("unscheduled")}</span>
              {unscheduled.length > 0 && <CountBadge n={unscheduled.length} />}
            </div>
            {unscheduled.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>{t("noUnscheduled")}</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {unscheduled.slice(0, 6).map((u) => (
                  <div key={u.id} style={{ padding: "11px 13px", borderRadius: 11, background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--heading)", marginBlockEnd: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{u.hook}</div>
                    <Link href="/approvals" style={{ display: "block", textAlign: "center", padding: "7px 0", borderRadius: 9, border: "1px solid var(--border-2)", fontSize: 12.5, fontWeight: 600, color: "var(--navy)" }}>{t("scheduleBtn")}</Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Left column: month grid */}
        <section style={{ ...card, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBlockEnd: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 700, color: "var(--heading)", fontSize: 17 }}>{monthName}</span>
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
