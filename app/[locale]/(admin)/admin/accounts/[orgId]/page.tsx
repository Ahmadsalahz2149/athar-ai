import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { orgDetail } from "@/lib/db/admin";
import { OrgActions } from "./OrgActions";

export const dynamic = "force-dynamic";

export default async function AdminOrgDetail({ params }: { params: Promise<{ locale: string; orgId: string }> }) {
  const { locale, orgId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin");
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const detail = await orgDetail(orgId);
  if (!detail) notFound();

  const fmtDate = (d: Date) => new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { dateStyle: "medium" }).format(new Date(d));

  return (
    <div style={{ animation: "floatUp .4s ease" }}>
      <Link href="/admin/accounts" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>← {t("backToAccounts")}</Link>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBlock: "12px 4px", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, color: "var(--heading)" }}>{detail.org.name}</h1>
        {detail.org.suspended && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--coral,#dc2626)", background: "var(--coral-tint,#fde8e8)", padding: "4px 12px", borderRadius: 999 }}>{t("suspended")}</span>}
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBlockEnd: 22 }}>{t("memberSince", { date: fmtDate(detail.org.createdAt) })} · {t("balanceLabel", { balance: nf.format(detail.balance) })}</p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 20, alignItems: "start" }} className="admin-detail-grid">
        {/* Left: info */}
        <div style={{ display: "grid", gap: 16 }}>
          {/* Members */}
          <section style={{ background: "var(--card,#fff)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--heading)", marginBlockEnd: 12 }}>{t("members")}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {detail.members.map((m) => (
                <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "var(--teal-tint)", color: "var(--teal-deep)", fontWeight: 700, fontSize: 12 }}>{(m.email || "?").slice(0, 1).toUpperCase()}</span>
                  <span style={{ flex: 1, color: "var(--heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email || t("noEmail")}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", background: "var(--surface,#f9fafb)", padding: "3px 9px", borderRadius: 999 }}>{m.role}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Brands + counts */}
          <section style={{ background: "var(--card,#fff)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--heading)", marginBlockEnd: 12 }}>{t("brandsAndContent")}</div>
            <div style={{ display: "flex", gap: 18, marginBlockEnd: 14, flexWrap: "wrap" }}>
              <Stat label={t("statDrafts")} value={nf.format(detail.counts.drafts)} />
              <Stat label={t("statSources")} value={nf.format(detail.counts.sources)} />
              <Stat label={t("statIdeas")} value={nf.format(detail.counts.ideas)} />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {detail.brands.map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "8px 10px", borderRadius: 9, background: "var(--surface,#f9fafb)" }}>
                  <span style={{ fontWeight: 600, color: "var(--heading)" }}>{b.name}</span>
                  {b.handle && <span style={{ fontSize: 11.5, color: "var(--muted)", fontFamily: "var(--font-latin)" }}>@{b.handle}</span>}
                </div>
              ))}
            </div>
          </section>

          {/* Ledger */}
          <section style={{ background: "var(--card,#fff)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--heading)", marginBlockEnd: 12 }}>{t("recentLedger")}</div>
            <div style={{ display: "grid", gap: 6 }}>
              {detail.ledger.map((l, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, padding: "7px 0", borderBlockEnd: i < detail.ledger.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ flex: 1, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.reason}</span>
                  <span style={{ fontWeight: 700, fontFamily: "var(--font-latin)", color: l.delta >= 0 ? "var(--teal-deep)" : "var(--coral,#dc2626)" }}>{l.delta >= 0 ? "+" : ""}{nf.format(l.delta)}</span>
                  <span style={{ fontFamily: "var(--font-latin)", color: "var(--subtle)", minWidth: 44, textAlign: "end" }}>{nf.format(l.balanceAfter)}</span>
                </div>
              ))}
              {detail.ledger.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("noLedger")}</div>}
            </div>
          </section>
        </div>

        {/* Right: actions */}
        <OrgActions orgId={detail.org.id} suspended={detail.org.suspended} balance={detail.balance} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--heading)", fontFamily: "var(--font-latin)" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{label}</div>
    </div>
  );
}
