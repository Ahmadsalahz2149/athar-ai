import { setRequestLocale, getTranslations } from "next-intl/server";
import { listCoupons } from "@/lib/db/admin";
import { CouponsClient } from "./CouponsClient";

export const dynamic = "force-dynamic";

export default async function AdminCoupons({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin");
  const coupons = await listCoupons();

  return (
    <div style={{ animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, color: "var(--heading)" }}>{t("couponsTitle")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBlock: "6px 20px" }}>{t("couponsSubtitle")}</p>
      <CouponsClient
        coupons={coupons.map((c) => ({ id: c.id, code: c.code, credits: c.credits, maxRedemptions: c.maxRedemptions, redemptions: c.redemptions, active: c.active, expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null }))}
        locale={locale}
      />
    </div>
  );
}
