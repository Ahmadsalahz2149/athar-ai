import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { EMPTY_LINK_PAGE, type LinkPage } from "@/lib/link/types";
import { MyLinkClient } from "./MyLinkClient";

export const dynamic = "force-dynamic";

export default async function MyLinkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("MyLink");

  let handle = "";
  let page: LinkPage = EMPTY_LINK_PAGE;
  let stats = { views: 0, clicks: 0 };
  let name = "";
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const [info, s] = await Promise.all([org.getLinkInfo(ctx.brandId), org.linkStats(ctx.brandId)]);
      handle = info.handle ?? "";
      page = info.page;
      name = info.name;
      stats = s;
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <h1 className="headline-gradient" style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", marginBlock: "6px 20px" }}>{t("subtitle")}</p>
      <MyLinkClient handle={handle} page={page} stats={stats} name={name} locale={locale} />
    </main>
  );
}
