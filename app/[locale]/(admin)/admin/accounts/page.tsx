import { setRequestLocale, getTranslations } from "next-intl/server";
import { listOrgs } from "@/lib/db/admin";
import { AccountsClient } from "./AccountsClient";

export const dynamic = "force-dynamic";

export default async function AdminAccounts({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin");
  const orgs = await listOrgs();

  return (
    <div style={{ animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, color: "var(--heading)" }}>{t("accountsTitle")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBlock: "6px 20px" }}>{t("accountsSubtitle")}</p>
      <AccountsClient orgs={orgs.map((o) => ({ id: o.id, name: o.name, ownerEmail: o.ownerEmail, balance: o.balance, brands: o.brands, members: o.members, suspended: o.suspended }))} locale={locale} />
    </div>
  );
}
