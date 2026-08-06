import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TopBar } from "@/components/TopBar";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return (
    <>
      <TopBar />
      <main
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "clamp(48px,9vw,110px) clamp(20px,6vw,32px)",
          textAlign: "center",
          animation: "floatUp .5s ease",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 13px",
            borderRadius: 999,
            background: "var(--teal-tint-2)",
            border: "1px solid rgba(15, 118, 110,.32)",
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--teal-deep)",
            marginBlockEnd: 26,
          }}
        >
          {t("badge")}
        </div>
        <h1
          style={{
            fontSize: "clamp(30px,6vw,46px)",
            fontWeight: 700,
            color: "var(--heading)",
            letterSpacing: "-.5px",
            lineHeight: 1.35,
            marginBlockEnd: 18,
          }}
        >
          {t("title")}
        </h1>
        <p
          style={{
            fontSize: "clamp(15px,2.4vw,17px)",
            lineHeight: 1.9,
            color: "var(--muted)",
            maxWidth: 560,
            margin: "0 auto 34px",
          }}
        >
          {t("subtitle")}
        </p>
        <Link
          href="/studio"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 52,
            padding: "0 30px",
            background: "linear-gradient(135deg,#273343,#1F2937)",
            color: "#fff",
            borderRadius: 13,
            fontSize: 15.5,
            fontWeight: 700,
            boxShadow: "0 12px 26px -12px rgba(11,31,51,.7)",
          }}
        >
          {t("cta")}
        </Link>
        <div style={{ marginBlockStart: 14 }}>
          <Link href="/onboarding/1" style={{ color: "var(--teal-deep)", fontWeight: 600, fontSize: 14 }}>
            {t("startLink")}
          </Link>
        </div>
        <p style={{ marginBlockStart: 18, fontSize: 12.5, color: "var(--subtle)" }}>
          {t("note")}
        </p>
      </main>
    </>
  );
}
