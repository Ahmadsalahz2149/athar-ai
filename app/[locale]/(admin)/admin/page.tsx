import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { platformStats, listOrgs } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

function Kpi({ label, value, tone = "teal" }: { label: string; value: string; tone?: "teal" | "gold" | "navy" | "red" }) {
  const tint: Record<string, string> = { teal: "var(--teal-tint)", gold: "var(--gold-tint)", navy: "#eef1f5", red: "var(--coral-tint,#fde8e8)" };
  const fg: Record<string, string> = { teal: "var(--teal-deep)", gold: "var(--gold-dark)", navy: "#273343", red: "var(--coral,#dc2626)" };
  return (
    <div style={{ background: "var(--card,#fff)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }} className="lift">
      <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: fg[tone], marginBlockStart: 6, fontFamily: "var(--font-latin)", letterSpacing: "-1px" }}>{value}</div>
      <div style={{ height: 4, borderRadius: 999, background: tint[tone], marginBlockStart: 12 }} />
    </div>
  );
}

export default async function AdminDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin");
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const [stats, orgs] = await Promise.all([platformStats(), listOrgs()]);
  const recent = orgs.slice(0, 6);

  return (
    <div style={{ animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, color: "var(--heading)" }}>{t("dashTitle")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBlock: "6px 20px" }}>{t("dashSubtitle")}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        <Kpi label={t("kpiOrgs")} value={nf.format(stats.orgs)} tone="teal" />
        <Kpi label={t("kpiNew7d")} value={`+${nf.format(stats.newOrgs7d)}`} tone="gold" />
        <Kpi label={t("kpiBrands")} value={nf.format(stats.brands)} tone="navy" />
        <Kpi label={t("kpiSuspended")} value={nf.format(stats.suspended)} tone="red" />
        <Kpi label={t("kpiIssued")} value={nf.format(stats.creditsIssued)} tone="teal" />
        <Kpi label={t("kpiSpent")} value={nf.format(stats.creditsSpent)} tone="gold" />
        <Kpi label={t("kpiAdmins")} value={nf.format(stats.admins)} tone="navy" />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBlock: "28px 12px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--heading)" }}>{t("recentAccounts")}</h2>
        <Link href="/admin/accounts" style={{ fontSize: 13, fontWeight: 600, color: "var(--teal-deep)", textDecoration: "none" }}>{t("viewAll")} ←</Link>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {recent.map((o) => (
          <Link key={o.id} href={`/admin/accounts/${o.id}`} className="lift" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", textDecoration: "none" }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", background: "var(--teal-tint)", color: "var(--teal-deep)", fontWeight: 700 }}>{o.name.slice(0, 1).toUpperCase()}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.ownerEmail || t("noEmail")}</div>
            </div>
            {o.suspended && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--coral,#dc2626)", background: "var(--coral-tint,#fde8e8)", padding: "3px 9px", borderRadius: 999 }}>{t("suspended")}</span>}
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>{nf.format(o.balance)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
