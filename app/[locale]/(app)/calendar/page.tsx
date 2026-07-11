import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";

export default async function CalendarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Calendar");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { month: "long", year: "numeric" }).format(now);

  const byDay = new Map<number, { hook: string; platform: string }[]>();
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const rows = await forOrg(db, ctx.orgId).scheduledDrafts(ctx.brandId);
      for (const r of rows) {
        if (!r.scheduledAt) continue;
        const dt = new Date(r.scheduledAt);
        if (dt.getFullYear() === year && dt.getMonth() === month) {
          const arr = byDay.get(dt.getDate()) ?? [];
          arr.push({ hook: r.hook, platform: r.platform });
          byDay.set(dt.getDate(), arr);
        }
      }
    }
  }

  const weekdays = t("weekdays").split("،").map((s) => s.trim());
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(24px,4vw,40px) clamp(16px,4vw,32px) 80px", animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, marginBlock: "6px 8px" }}>{t("subtitle")}</p>
      <div style={{ fontWeight: 700, color: "var(--heading)", marginBlock: "14px 12px", fontSize: 17 }}>{monthName}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
        {weekdays.map((w, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "var(--muted)", padding: "6px 0" }}>{w}</div>
        ))}
        {cells.map((d, i) => (
          <div key={i} style={{ minHeight: 92, borderRadius: 12, border: "1px solid var(--border)", background: d === null ? "transparent" : d === today ? "var(--teal-tint-2)" : "var(--card)", padding: 8 }}>
            {d !== null && (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: d === today ? "var(--teal-deep)" : "var(--slate)", fontFamily: "var(--font-latin)" }}>{d}</div>
                <div style={{ display: "grid", gap: 4, marginBlockStart: 6 }}>
                  {(byDay.get(d) ?? []).slice(0, 3).map((p, j) => (
                    <div key={j} style={{ fontSize: 10.5, padding: "3px 6px", borderRadius: 6, background: "var(--navy)", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.hook}>{p.hook}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <p style={{ marginBlockStart: 16, fontSize: 13, color: "var(--muted)" }}>{t("hint")}</p>
    </main>
  );
}
