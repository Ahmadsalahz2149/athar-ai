import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { getSupabaseServer } from "@/lib/supabase/server";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Settings");

  let email = "";
  let balance = 0;
  let completeness = 0;
  const supabase = await getSupabaseServer();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? "";
  }
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const [b, dna] = await Promise.all([org.balance(), org.currentDna(ctx.brandId)]);
      balance = b;
      completeness = dna?.completion_pct ?? 0;
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "clamp(24px,4vw,40px) clamp(16px,4vw,32px) 80px", animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px", marginBlockEnd: 20 }}>{t("title")}</h1>
      <SettingsClient email={email} balance={balance} completeness={completeness} />
    </main>
  );
}
