import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { brandByHandle, recordLinkEvent } from "@/lib/link/publicLookup";
import { safeUrl } from "@/lib/link/types";
import { LinkList } from "./LinkList";

export const dynamic = "force-dynamic";

export default async function PublicLinkPage({ params }: { params: Promise<{ locale: string; handle: string }> }) {
  const { locale, handle } = await params;
  setRequestLocale(locale);
  const brand = await brandByHandle(handle.toLowerCase());
  if (!brand) notFound();
  // Count the visit (best-effort).
  await recordLinkEvent(brand.orgId, brand.brandId, "view");

  const initial = (brand.name || "؟").trim().charAt(0);
  const links = brand.page.links.map((l) => ({ label: l.label, url: safeUrl(l.url) })).filter((l) => l.url);

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,var(--navy),var(--navy-2))", display: "flex", justifyContent: "center", padding: "48px 18px" }}>
      <div style={{ width: "100%", maxWidth: 460, textAlign: "center", color: "#fff" }}>
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt="" width={92} height={92} style={{ width: 92, height: 92, borderRadius: 22, objectFit: "cover", margin: "0 auto", border: "2px solid rgba(255,255,255,.15)" }} />
        ) : (
          <div style={{ width: 92, height: 92, borderRadius: 22, margin: "0 auto", display: "grid", placeItems: "center", background: "rgba(15, 118, 110,.2)", color: "var(--teal-light,#5eead4)", fontSize: 40, fontWeight: 800 }}>{initial}</div>
        )}
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBlockStart: 16, letterSpacing: "-.4px" }}>{brand.page.headline || brand.name}</h1>
        {brand.page.bio && <p style={{ fontSize: 15, color: "#B7C4D4", lineHeight: 1.8, marginBlock: "10px 4px" }}>{brand.page.bio}</p>}

        <LinkList orgId={brand.orgId} brandId={brand.brandId} links={links} />

        <div style={{ marginBlockStart: 34, fontSize: 12 }}>
          <a href={`/${locale}`} style={{ color: "#8095AC", textDecoration: "none" }}>Athar AI</a>
        </div>
      </div>
    </main>
  );
}
