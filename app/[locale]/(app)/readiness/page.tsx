import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { profileHasContent } from "@/lib/brand/profile";
import { kitHasContent } from "@/lib/distribution/types";
import { ScoreRadial } from "@/components/ui/display";

export const dynamic = "force-dynamic";

type Item = { key: string; done: boolean; href: string };

export default async function ReadinessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Readiness");

  const REWARD = 50;
  let items: Item[] = [];
  let rewarded = false;
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const [counts, dna, profile, products, brand, conns, dist, link] = await Promise.all([
        org.counts(ctx.brandId),
        org.currentDna(ctx.brandId),
        org.getBrandProfile(ctx.brandId),
        org.listProducts(ctx.brandId),
        org.getBrand(ctx.brandId),
        org.listConnections(ctx.brandId),
        org.getDistribution(ctx.brandId),
        org.getLinkInfo(ctx.brandId),
      ]);
      items = [
        { key: "sources", done: counts.sources >= 1, href: "/ingest" },
        { key: "dna", done: (dna?.completion_pct ?? 0) >= 40, href: "/dna" },
        { key: "profile", done: profileHasContent(profile) || products.length > 0, href: "/brand" },
        { key: "logo", done: !!brand?.logoUrl, href: "/brand" },
        { key: "draft", done: counts.drafts >= 1, href: "/studio" },
        { key: "published", done: counts.published + counts.scheduled >= 1, href: "/calendar" },
        { key: "social", done: conns.some((c) => c.status === "connected"), href: "/settings?tab=platforms" },
        { key: "distribution", done: kitHasContent(dist), href: "/distribute" },
        { key: "link", done: !!link.handle, href: "/mylink" },
      ];
      if (items.every((i) => i.done)) {
        // All steps complete — grant the launch reward once (idempotent).
        await org.grantOnce(REWARD, "readiness_complete").catch(() => {});
        rewarded = true;
      }
    }
  }

  const doneN = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((doneN / items.length) * 100) : 0;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <h1 className="headline-gradient" style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", marginBlock: "6px 20px" }}>{t("subtitle")}</p>

      {rewarded && pct === 100 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, background: "var(--gold-tint)", border: "1px solid var(--gold)", marginBlockEnd: 16 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--gold-dark)" }}>{t("rewardTitle")}</div>
            <div style={{ fontSize: 12.8, color: "var(--gold-dark)", marginBlockStart: 2, opacity: 0.9 }}>{t("rewardBody", { credits: REWARD })}</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 18, background: "linear-gradient(160deg,#273343,#1F2937)", borderRadius: 18, padding: 22, color: "#fff", marginBlockEnd: 18 }}>
        <ScoreRadial value={pct} size={92} suffix="%" track="rgba(255,255,255,.14)" valueColor="#fff" label={t("ready")} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{t("readyN", { done: doneN, total: items.length })}</div>
          <div style={{ fontSize: 13.5, color: "#9FB3C8", marginBlockStart: 4 }}>{pct === 100 ? t("allDone") : t("keepGoing")}</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {items.map((it) => (
          <Link key={it.key} href={it.href} className="lift" style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", textDecoration: "none" }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: it.done ? "var(--teal)" : "transparent", border: it.done ? "none" : "1.5px solid var(--border-2)" }}>
              {it.done && <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--heading)", textDecoration: it.done ? "line-through" : "none", opacity: it.done ? 0.7 : 1 }}>{t(`item_${it.key}`)}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBlockStart: 2 }}>{t(`hint_${it.key}`)}</div>
            </div>
            {!it.done && <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--teal-deep)" }}>{t("do")} ←</span>}
          </Link>
        ))}
      </div>
    </main>
  );
}
