import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { EMPTY_PROFILE, type BrandProfile } from "@/lib/brand/profile";
import { BrandClient, type BrandData } from "./BrandClient";

export default async function BrandPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("BrandKit");

  let data: BrandData = {
    brandId: "",
    name: "",
    logoUrl: null,
    profile: EMPTY_PROFILE,
    products: [],
    brands: [],
  };

  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const [brand, profile, products, brands] = await Promise.all([
        org.getBrand(ctx.brandId),
        org.getBrandProfile(ctx.brandId),
        org.listProducts(ctx.brandId),
        org.listBrands(),
      ]);
      data = {
        brandId: ctx.brandId,
        name: brand?.name ?? "",
        logoUrl: brand?.logoUrl ?? null,
        profile: profile as BrandProfile,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          description: p.description,
          price: p.price,
          url: p.url,
        })),
        brands: brands.map((b) => ({ id: b.id, name: b.name, logoUrl: b.logoUrl })),
      };
    }
  }

  return (
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <h1 className="headline-gradient" style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, letterSpacing: "-.4px" }}>
        {t("title")}
      </h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", marginBlock: "6px 22px" }}>{t("subtitle")}</p>
      <BrandClient data={data} />
    </main>
  );
}
