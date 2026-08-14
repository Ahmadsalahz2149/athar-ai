import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LandingNav } from "@/components/landing/LandingNav";
import { Showcase } from "@/components/landing/Showcase";
import { Faq } from "@/components/landing/Faq";
import { Reveal } from "@/components/landing/Reveal";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Landing");

  const features: { key: string; title: string; body: string; icon: ReactNode; tint?: boolean }[] = [
    { key: "dna", title: t("fDna"), body: t("fDnaB"), tint: true, icon: <path d="M7 4c6 3 4 8 10 11M17 4c-6 3-4 8-10 11M8 6h8M8 18h8" /> },
    { key: "studio", title: t("fStudio"), body: t("fStudioB"), icon: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /> },
    { key: "media", title: t("fMedia"), body: t("fMediaB"), icon: <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM10 9l5 3-5 3z" /> },
    { key: "scenes", title: t("fScenes"), body: t("fScenesB"), icon: <path d="M4 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM16 10l4-2v8l-4-2" /> },
    { key: "bilingual", title: t("fBilingual"), body: t("fBilingualB"), icon: <path d="M4 5h7M7 4v1c0 4-2 7-5 8M5 9c0 3 3 5 6 5M13 20l4-9 4 9M14.5 17h5" /> },
    { key: "plan", title: t("fPlan"), body: t("fPlanB"), icon: <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9h16M8 3v4M16 3v4" /> },
    { key: "ideas", title: t("fIdeas"), body: t("fIdeasB"), icon: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c.7.7 1 1.3 1 2h6c0-.7.3-1.3 1-2a6 6 0 0 0-4-10z" /> },
    { key: "analytics", title: t("fAnalytics"), body: t("fAnalyticsB"), icon: <path d="M4 19V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM8 15l3-4 3 3 3-5" /> },
  ];

  const steps = [
    { n: 1, title: t("how1"), body: t("how1b") },
    { n: 2, title: t("how2"), body: t("how2b") },
    { n: 3, title: t("how3"), body: t("how3b") },
  ];

  const plans = [
    { key: "free", name: t("planFree"), price: t("planFreeP"), period: t("priceFree"), feats: t("planFreeF").split("|"), cta: t("planFreeCta"), href: "/signup", feat: false },
    { key: "pro", name: t("planPro"), price: t("planProP"), period: t("priceMo"), feats: t("planProF").split("|"), cta: t("planProCta"), href: "/signup", feat: true },
    { key: "agency", name: t("planAgency"), price: t("planAgencyP"), period: t("priceMo"), feats: t("planAgencyF").split("|"), cta: t("planAgencyCta"), href: "/signup", feat: false },
  ];

  return (
    <div className="lp">
      <LandingNav />

      {/* Hero */}
      <header className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div>
            <span className="lp-eyebrow">{t("heroEyebrow")}</span>
            <h1>{t("heroTitle")}</h1>
            <p className="lp-lead">{t("heroSub")}</p>
            <div className="lp-hero-cta">
              <Link href="/signup" className="lp-btn lp-btn-primary lp-btn-lg">{t("heroCta")}</Link>
              <a href="#how" className="lp-btn lp-btn-ghost lp-btn-lg">{t("heroCta2")}</a>
            </div>
            <p className="lp-hero-trust">{t("heroTrust")}</p>
            <svg className="lp-trace" viewBox="0 0 340 40" preserveAspectRatio="none" aria-hidden><path d="M2 28 C 60 6, 110 6, 150 22 S 250 40, 338 12" /></svg>
          </div>

          {/* Signature artifact: the Content DNA card + an on-voice post */}
          <div className="lp-artifact">
            <div className="lp-card lp-dna">
              <div className="lp-ring"><i>{t("statMatchV")}</i></div>
              <div className="lp-dna-head">
                <span className="lp-dna-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 4c6 3 4 8 10 11M17 4c-6 3-4 8-10 11M8 6h8M8 18h8" /></svg>
                </span>
                <strong style={{ fontSize: 14.5, color: "var(--heading)" }}>{t("dnaLabel")}</strong>
              </div>
              <div className="lp-dna-row"><span className="lp-dna-k">{t("dnaDialect")}</span><span className="lp-dna-v">{t("dnaDialectVal")}</span></div>
              <div className="lp-dna-row"><span className="lp-dna-k">{t("dnaTone")}</span><span className="lp-dna-v">{t("dnaToneVal")}</span></div>
              <div className="lp-dna-row"><span className="lp-dna-k">{t("dnaMatch")}</span><span className="lp-dna-v" style={{ color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>{t("statMatchV")}</span></div>
            </div>

            <div className="lp-card lp-post">
              <div className="lp-post-head">
                <span className="lp-post-av">✦</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--heading)" }}>{t("postName")}</span>
              </div>
              <div className="lp-post-hook">{t("postHook")}</div>
              <div className="lp-post-body">{t("postBody")}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Stat strip */}
      <div className="lp-wrap lp-reveal">
        <div className="lp-stats">
          <div className="lp-stat"><b>{t("statMatchV")}</b><span>{t("statMatch")}</span></div>
          <div className="lp-stat"><b>{t("statLangV")}</b><span>{t("statLang")}</span></div>
          <div className="lp-stat"><b>{t("statTimeV")}</b><span>{t("statTime")}</span></div>
        </div>
      </div>

      {/* How it works */}
      <section id="how" className="lp-section">
        <div className="lp-wrap lp-center lp-reveal">
          <span className="lp-eyebrow">{t("navHow")}</span>
          <h2 className="lp-h2" style={{ marginBlock: "14px 8px" }}>{t("howTitle")}</h2>
          <p className="lp-lead">{t("howSub")}</p>
          <div className="lp-steps" style={{ textAlign: "start" }}>
            {steps.map((s) => (
              <div key={s.n} className="lp-step">
                <div className="lp-step-n">{new Intl.NumberFormat(locale === "ar" ? "ar" : "en").format(s.n)}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="lp-section" style={{ paddingBlockStart: 0 }}>
        <div className="lp-wrap lp-center lp-reveal">
          <span className="lp-eyebrow">{t("navFeatures")}</span>
          <h2 className="lp-h2" style={{ marginBlock: "14px 8px" }}>{t("featTitle")}</h2>
          <p className="lp-lead">{t("featSub")}</p>
          <div className="lp-bento" style={{ textAlign: "start" }}>
            {features.map((f) => (
              <div key={f.key} className="lp-feat" style={f.tint ? { background: "var(--teal-tint,#e6f2f0)", borderColor: "color-mix(in srgb,var(--teal) 30%, var(--border))" } : undefined}>
                <span className="lp-feat-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg></span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase (studio) */}
      <section className="lp-section" style={{ paddingBlockStart: 0 }}>
        <div className="lp-wrap lp-reveal"><Showcase /></div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="lp-section">
        <div className="lp-wrap lp-center lp-reveal">
          <span className="lp-eyebrow">{t("navPricing")}</span>
          <h2 className="lp-h2" style={{ marginBlock: "14px 8px" }}>{t("priceTitle")}</h2>
          <p className="lp-lead">{t("priceSub")}</p>
          <div className="lp-prices" style={{ textAlign: "start" }}>
            {plans.map((p) => (
              <div key={p.key} className={`lp-price${p.feat ? " feat" : ""}`}>
                {p.feat && <span className="lp-price-badge">{t("priceBadge")}</span>}
                <h3>{p.name}</h3>
                <div className="lp-price-amt"><b>{p.price}</b><span>{p.period}</span></div>
                <ul>
                  {p.feats.map((ft, i) => (
                    <li key={i}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 6" /></svg>{ft}</li>
                  ))}
                </ul>
                <Link href={p.href} className={`lp-btn ${p.feat ? "lp-btn-primary" : "lp-btn-ghost"}`} style={{ width: "100%" }}>{p.cta}</Link>
              </div>
            ))}
          </div>
          <p className="lp-price-note">{t("priceNote")}</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="lp-section" style={{ paddingBlockStart: 0 }}>
        <div className="lp-wrap lp-center lp-reveal">
          <span className="lp-eyebrow">{t("navFaq")}</span>
          <h2 className="lp-h2" style={{ marginBlock: "14px 0" }}>{t("faqTitle")}</h2>
          <Faq />
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-section" style={{ paddingBlockStart: 0 }}>
        <div className="lp-wrap lp-reveal">
          <div className="lp-final">
            <h2>{t("finalTitle")}</h2>
            <p>{t("finalSub")}</p>
            <Link href="/signup" className="lp-btn lp-btn-lg">{t("finalCta")}</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-foot">
        <div className="lp-wrap">
          <div className="lp-foot-grid">
            <div>
              <Link href="/" className="lp-brand"><span className="lp-brand-mark">✦</span><span>أثر</span></Link>
              <p className="lp-foot-tag">{t("footTagline")}</p>
            </div>
            <div className="lp-foot-col">
              <h4>{t("footProduct")}</h4>
              <a href="#features">{t("footFeatures")}</a>
              <a href="#pricing">{t("footPricing")}</a>
              <Link href="/studio">{t("footStudio")}</Link>
            </div>
            <div className="lp-foot-col">
              <h4>{t("footCompany")}</h4>
              <a href="#how">{t("footAbout")}</a>
              <a href="mailto:hello@athar.ai">{t("footContact")}</a>
            </div>
            <div className="lp-foot-col">
              <h4>{t("footLegal")}</h4>
              <Link href="/privacy">{t("footPrivacy")}</Link>
              <Link href="/terms">{t("footTerms")}</Link>
            </div>
          </div>
          <div className="lp-foot-bottom">© {new Date().getFullYear()} أثر AI · {t("footRights")}</div>
        </div>
      </footer>

      <Reveal />
    </div>
  );
}
