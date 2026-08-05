import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { EMPTY_PLAN, monthKey, type MonthlyPlan } from "@/lib/plan/types";
import { upcomingDays } from "@/lib/plan/worldDays";
import { PlanClient, type Occasion } from "./PlanClient";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Plan");

  // Current month in the server's time. Good enough for a planning surface.
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const mKey = monthKey(year, month);
  const monthName = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { month: "long", year: "numeric" }).format(now);

  const occasions: Occasion[] = upcomingDays(month, now.getDate(), 8).map((d) => ({
    label: locale === "ar" ? d.ar : d.en,
    month: d.month,
    day: d.day,
    tag: d.tag,
  }));

  let plan: MonthlyPlan = EMPTY_PLAN;
  let hasDna = false;
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const [p, dna] = await Promise.all([org.getPlan(ctx.brandId, mKey), org.currentDna(ctx.brandId)]);
      plan = p;
      hasDna = !!dna;
    }
  }

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <h1 className="headline-gradient" style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, letterSpacing: "-.4px" }}>
        {t("title")}
      </h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", marginBlock: "6px 20px", maxWidth: 680 }}>{t("subtitle")}</p>
      <PlanClient plan={plan} month={mKey} monthName={monthName} occasions={occasions} hasDna={hasDna} locale={locale} />
    </main>
  );
}
