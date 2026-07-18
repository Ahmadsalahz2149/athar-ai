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
  let fullName = "";
  let title = "";
  let bio = "";
  let onboarding: Record<string, string> = {};
  let balance = 0;
  let completeness = 0;
  let sourcesUsed = 0;

  const supabase = await getSupabaseServer();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    const m = data.user?.user_metadata ?? {};
    email = data.user?.email ?? "";
    fullName = (m.full_name as string) || "";
    title = (m.title as string) || "";
    bio = (m.bio as string) || "";
    onboarding = (m.onboarding as Record<string, string>) ?? {};
  }
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const [b, dna, c] = await Promise.all([org.balance(), org.currentDna(ctx.brandId), org.counts(ctx.brandId)]);
      balance = b;
      completeness = dna?.completion_pct ?? 0;
      sourcesUsed = c.sources;
    }
  }

  // Map onboarding answer keys → display labels via the Onboarding namespace.
  const to = await getTranslations("Onboarding");
  const safe = (ns: (k: string) => string, prefix: string, val?: string) => (val ? ns(`${prefix}${val}`) : "");

  return (
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", marginBlock: "6px 20px" }}>{t("subtitle")}</p>
      <SettingsClient
        email={email}
        fullName={fullName}
        title={title}
        bio={bio}
        balance={balance}
        completeness={completeness}
        sourcesUsed={sourcesUsed}
        sourcesLimit={5}
        brandType={safe(to, "bt_", onboarding.brandType)}
        field={safe(to, "field_", onboarding.field)}
        audience={safe(to, "aud_", onboarding.audience)}
        dialect={safe(to, "dia_", onboarding.dialect)}
      />
    </main>
  );
}
