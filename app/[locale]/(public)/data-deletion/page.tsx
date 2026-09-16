import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { deletionStatus } from "@/lib/social/metaDeletion";

/**
 * Where Meta sends someone to check on their deletion request (Phase 6).
 *
 * Meta requires the callback to return a URL the person can open, and this is
 * it. Public and unauthenticated by necessity: whoever asked Facebook to erase
 * their data has no account here, and requiring one to hear the answer would
 * defeat the point.
 *
 * It reveals nothing but the state of that one request. The code is the only
 * key, it is not guessable in practice, and an unknown code is answered with
 * "we have no record" rather than anything about who else might exist.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DataDeletionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("DataDeletion");
  const code = (await searchParams).code?.trim() ?? "";

  const status = code ? await deletionStatus(code) : null;
  const dtf = new Intl.DateTimeFormat(locale === "en" ? "en" : "ar", { dateStyle: "long", timeStyle: "short" });

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--surface)", padding: "clamp(24px,5vw,48px) 18px" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--heading)", lineHeight: 1.6 }}>{t("title")}</h1>
        <p style={{ fontSize: 14.5, color: "var(--slate)", lineHeight: 1.95, marginBlock: "12px 22px" }}>{t("intro")}</p>

        {!code && (
          <form style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              name="code"
              placeholder={t("codePlaceholder")}
              style={{ flex: "1 1 220px", height: 42, borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--heading)", paddingInline: 12, fontSize: 14, fontFamily: "var(--font-latin)", letterSpacing: ".06em" }}
            />
            <button type="submit" style={{ height: 42, paddingInline: 20, borderRadius: 10, border: "none", background: "var(--navy)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              {t("check")}
            </button>
          </form>
        )}

        {status && !status.found && (
          <div style={{ padding: "16px 18px", borderRadius: 13, background: "var(--gold-tint)", border: "1px solid rgba(214,168,79,.4)" }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--heading)" }}>{t("notFoundTitle")}</div>
            <p style={{ fontSize: 13.5, color: "var(--slate)", lineHeight: 1.9, marginBlockStart: 6 }}>{t("notFoundBody")}</p>
          </div>
        )}

        {status?.found && (
          <div style={{ padding: "16px 18px", borderRadius: 13, background: "var(--teal-tint-2)", border: "1px solid rgba(15,118,110,.3)" }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--teal-deep)" }}>{t("doneTitle")}</div>
            <p style={{ fontSize: 13.5, color: "var(--slate)", lineHeight: 1.9, marginBlock: "8px 0" }}>
              {t("doneBody", { n: status.deleted })}
            </p>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginBlockStart: 10, fontFamily: "var(--font-latin)" }}>
              {code} · {dtf.format(status.completedAt ?? status.requestedAt)}
            </p>
          </div>
        )}

        <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.9, marginBlockStart: 22 }}>{t("scope")}</p>
      </div>
    </main>
  );
}
