import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { paymentsEnabled } from "@/lib/payments/stripe";
import { effectivePlan } from "@/lib/payments/plans";
import { taxEnabled, bpsToPercent, formatAmount } from "@/lib/payments/tax";
import { log } from "@/lib/log";
import { BillingClient, type InvoiceView } from "./BillingClient";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ purchase?: string }>;
}) {
  const { locale } = await params;
  const { purchase } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Billing");

  let balance = 0;
  let referral = { code: "", count: 0 };
  let planId = "free";
  let planStatus: string | null = null;
  let renewsAt: string | null = null;
  let invoices: InvoiceView[] = [];
  let billingProfile: { name: string | null; country: string | null; taxId: string | null } | null = null;
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      // Each read is independently fault-tolerant: a billing page that 500s
      // because ONE query failed is worse than one showing conservative
      // defaults. (This bit: the subscription columns exist only after the
      // migration runs, and the deploy script does not run migrations.)
      const [b, r, ps, inv, bp] = await Promise.allSettled([
        org.balance(), org.getReferral(), org.planState(), org.listInvoices(24), org.billingProfile(),
      ]);
      if (b.status === "fulfilled") balance = b.value;
      if (r.status === "fulfilled") referral = r.value;
      if (inv.status === "fulfilled") {
        invoices = inv.value.map((i) => ({
          id: i.id,
          number: i.number,
          // Formatted on the server so the list renders identically before
          // hydration; the locale decides the calendar, not the browser.
          date: new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { year: "numeric", month: "short", day: "numeric" }).format(i.issuedAt),
          currency: i.currency,
          totalAmount: formatAmount(i.totalCents),
          taxAmount: formatAmount(i.taxCents),
          taxRatePct: i.taxRateBps === null ? null : bpsToPercent(i.taxRateBps),
          status: i.status,
          pdfUrl: i.invoicePdfUrl,
          hostedUrl: i.hostedInvoiceUrl,
        }));
      } else {
        log.error("billing.invoices_read_failed", {}, inv.reason);
      }
      if (bp.status === "fulfilled") billingProfile = bp.value;
      if (ps.status === "fulfilled") {
        // effectivePlan() decides entitlement; a lapsed subscription reads as free.
        planId = effectivePlan(ps.value.plan, ps.value.planStatus).id;
        planStatus = ps.value.planStatus;
        renewsAt = ps.value.planRenewsAt ? ps.value.planRenewsAt.toISOString().slice(0, 10) : null;
      } else {
        log.error("billing.plan_read_failed", {}, ps.reason);
      }
    }
  }

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <h1 className="headline-gradient" style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", marginBlock: "6px 20px" }}>{t("subtitle")}</p>
      <BillingClient
        balance={balance}
        referral={referral}
        locale={locale}
        payments={paymentsEnabled()}
        purchase={
          purchase === "success" ? "success" : purchase === "subscribed" ? "subscribed" : purchase === "cancelled" ? "cancelled" : null
        }
        currentPlan={planId}
        planStatus={planStatus}
        renewsAt={renewsAt}
        invoices={invoices}
        vatExclusive={taxEnabled()}
        billingProfile={billingProfile}
      />
    </main>
  );
}
