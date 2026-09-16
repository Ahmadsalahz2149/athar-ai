import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { reviewBoard } from "@/lib/review/publicReview";
import { consume, LIMITS } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { ReviewBoard } from "./ReviewBoard";

/** A review link's contents change as the agency works and as the client
 * answers, so a cached page is a page that lies. */
export const dynamic = "force-dynamic";

/** Nobody should be able to find a client's unreleased posts in a search index.
 * The token keeps it private; this keeps it unlisted. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ReviewPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Review");

  // The token is a bearer credential on an open page, so the read is capped per
  // IP: without it this is an oracle a script can grind against.
  if (!consume(`review:view:${await clientIp()}`, LIMITS.reviewView.limit, LIMITS.reviewView.windowMs).ok) {
    return <Shell title={t("err_rate_limited")} body={t("retryLater")} />;
  }

  const res = await reviewBoard(token);
  if (!res.ok) return <Shell title={t(`dead_${res.reason}_title`)} body={t(`dead_${res.reason}_body`)} />;

  const { board } = res;
  const initial = (board.brandName || "?").trim().charAt(0);

  return (
    <main style={{ minHeight: "100vh", background: "var(--surface)", padding: "clamp(24px,5vw,48px) clamp(14px,4vw,24px) 80px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBlockEnd: 8 }}>
          {board.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={board.logoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover" }} />
          ) : (
            <span style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 12, background: "var(--navy)", color: "#fff", fontWeight: 700, fontSize: 18 }}>{initial}</span>
          )}
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 700, color: "var(--heading)", margin: 0 }}>{board.brandName}</h1>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("header")}</div>
          </div>
        </header>
        <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.9, marginBlock: "10px 22px" }}>{t("intro")}</p>

        <ReviewBoard token={token} posts={board.posts} />

        <p style={{ marginBlockStart: 28, fontSize: 12, color: "var(--muted)", textAlign: "center", lineHeight: 1.8 }}>{t("footer")}</p>
      </div>
    </main>
  );
}

function Shell({ title, body }: { title: string; body: string }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--surface)", padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--heading)" }}>{title}</h1>
        <p style={{ fontSize: 14.5, color: "var(--slate)", lineHeight: 1.9, marginBlockStart: 10 }}>{body}</p>
      </div>
    </main>
  );
}
