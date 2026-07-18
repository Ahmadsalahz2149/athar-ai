import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { ApprovalsClient } from "./ApprovalsClient";

const QUEUE = ["pending", "approved", "scheduled", "needs_edit", "rejected"];

export default async function ApprovalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Approvals");

  let drafts: { id: string; hook: string; body: string; platform: string; status: string; postScore: number; dnaMatch: number; scheduledAt: string | null; reviewNote: string | null }[] = [];
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const rows = await forOrg(db, ctx.orgId).listDraftsByStatus(ctx.brandId);
      drafts = rows
        .filter((r) => QUEUE.includes(r.status))
        .map((r) => ({ id: r.id, hook: r.hook, body: r.body, platform: r.platform, status: r.status, postScore: r.postScore, dnaMatch: r.dnaMatch, scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null, reviewNote: r.reviewNote }));
    }
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(24px,4vw,40px) clamp(16px,4vw,32px) 80px", animation: "floatUp .4s ease" }}>
      <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, marginBlock: "6px 22px" }}>{t("subtitle")}</p>
      <ApprovalsClient drafts={drafts} />
    </main>
  );
}
