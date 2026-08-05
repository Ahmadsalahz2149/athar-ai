import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import type { ContentDna } from "@/lib/ai/prompts";
import { ScoreRadial, SegmentMeter, EmptyState, GlyphIcon, btnNavy, btnGhost } from "@/components/ui/display";
import { EditDnaModal } from "./EditDnaModal";
import { TraitSources } from "./TraitSources";
import { BuildDnaButton } from "./BuildDnaButton";

const PILLAR_META = [
  { key: "educational", glyph: "book", tint: "var(--gold-tint)", fg: "var(--gold-dark)" },
  { key: "story", glyph: "bookOpen", tint: "var(--teal-tint-2)", fg: "var(--teal-deep)" },
  { key: "proof", glyph: "trophy", tint: "var(--blue-tint)", fg: "var(--blue)" },
  { key: "soft_sell", glyph: "briefcase", tint: "var(--coral-tint)", fg: "var(--coral)" },
  { key: "thought_leadership", glyph: "bulb", tint: "#F3ECFB", fg: "#7C3AED" },
  { key: "engagement", glyph: "message", tint: "var(--border-3)", fg: "var(--slate-2)" },
] as const;

function Card({ title, latin, icon, children }: { title: string; latin?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBlockEnd: 14 }}>
        {icon}
        <span style={{ fontWeight: 700, color: "var(--heading)", fontSize: 15 }}>
          {latin && <span style={{ fontFamily: "var(--font-latin)", color: "var(--muted)", fontWeight: 600 }}>{latin} — </span>}
          {title}
        </span>
      </div>
      {children}
    </section>
  );
}
function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{k}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--heading)", textAlign: "end" }}>{children}</span>
    </div>
  );
}
function DotList({ items, color }: { items: string[]; color: string }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flex: "none" }} />
          <span style={{ fontSize: 14, color: "var(--slate)" }}>{it}</span>
        </div>
      ))}
    </div>
  );
}
function TintList({ items, tint, fg, icon }: { items: string[]; tint: string; fg: string; icon: string }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", borderRadius: 11, background: tint }}>
          <span style={{ color: fg, fontWeight: 800 }}>{icon}</span>
          <span style={{ fontSize: 13.5, color: "var(--slate)" }}>{it}</span>
        </div>
      ))}
    </div>
  );
}

export default async function DnaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dna");
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");

  let dna: ContentDna | null = null;
  let meta: { version: number; createdAt: Date; count: number } | null = null;
  let hasSources = false;
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const t = forOrg(db, ctx.orgId);
      const [d, m, chunks] = await Promise.all([t.currentDna(ctx.brandId), t.dnaMeta(ctx.brandId), t.countChunks(ctx.brandId)]);
      dna = d;
      meta = m;
      hasSources = chunks > 0;
    }
  }

  if (!dna) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "clamp(40px,8vw,90px) clamp(16px,4vw,32px)", textAlign: "center", animation: "floatUp .4s ease" }}>
        <EmptyState
          title={t("emptyTitle")}
          body={hasSources ? t("emptyBodyHasSources") : t("emptyBody")}
          cta={<BuildDnaButton hasSources={hasSources} buildLabel={t("buildFromSources")} onboardLabel={t("buildNow")} />}
        />
      </main>
    );
  }

  const pillars = PILLAR_META.map((p) => ({ ...p, label: t(`pillar_${p.key}`), pct: dna!.pillars[p.key] }));
  const pillarSum = pillars.reduce((a, p) => a + p.pct, 0);
  const weak = dna.completion_pct < 70;
  const dtf = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" });

  // Labels for the client edit modal.
  const editLabels = {
    edit: t("editDna"), title: t("editTitle"), save: t("editSave"), cancel: t("editCancel"), saving: t("editSaving"),
    tone: t("vTone"), dialect: t("vLang"), explain: t("vExplain"), dos: t("strengthsTitle"), donts: t("gapsTitle"),
    hooks: t("hookTitle"), ctas: t("ctaTitle"), pillars: t("pillarsTitle"), linesHint: t("editLinesHint"),
    sumOk: t("editSumOk"), sumBad: t("editSumBad"), saveError: t("editError"),
    pillar: Object.fromEntries(PILLAR_META.map((p) => [p.key, t(`pillar_${p.key}`)])),
  };
  const editInitial = {
    tone_traits: dna.tone_traits, dialect: dna.dialect, explanation_style: dna.explanation_style,
    dos: dna.dos, donts: dna.donts, hook_patterns: dna.hook_patterns, cta_patterns: dna.cta_patterns,
    pillars: dna.pillars,
  };

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      {/* Navy hero */}
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(160deg,#102A43,#0B1F33)", color: "#fff", borderRadius: 20, padding: 26 }}>
        <svg aria-hidden viewBox="0 0 300 300" style={{ position: "absolute", insetInlineStart: -40, insetBlockStart: -40, width: 320, height: 320, opacity: 0.4 }}>
          {[50, 90, 130].map((r) => <circle key={r} cx="150" cy="150" r={r} fill="none" stroke="rgba(94,234,212,.14)" strokeWidth="1.4" />)}
        </svg>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 560 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 13px", borderRadius: 999, background: "rgba(214,168,79,.16)", border: "1px solid rgba(214,168,79,.35)", color: "var(--gold)", fontSize: 12.5, fontWeight: 700 }}>
              ✦ {t("heroBadge")}
            </span>
            <h1 style={{ fontSize: "clamp(24px,3.2vw,30px)", fontWeight: 700, marginBlock: "14px 10px" }}>{t("title")}</h1>
            <p style={{ color: "#9FB3C8", lineHeight: 1.9, fontSize: 14.5 }}>{t("heroBody")}</p>
            {dna.summary && (
              <p style={{ marginBlockStart: 14, padding: "12px 15px", borderRadius: 12, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#E2E8F0", fontSize: 14, lineHeight: 1.85 }}>
                “{dna.summary}”
              </p>
            )}
            {meta && (
              <p style={{ marginBlockStart: 12, fontSize: 12, color: "#7E93A8", fontFamily: "var(--font-latin)" }}>
                v{meta.version} · {t("updatedOn", { date: dtf.format(meta.createdAt) })}{meta.count > 1 ? ` · ${t("versionsCount", { n: meta.count })}` : ""}
              </p>
            )}
          </div>
          <ScoreRadial value={dna.completion_pct} size={104} suffix="%" caption={t("completeness")} track="rgba(255,255,255,.14)" valueColor="#fff" label={t("completeness")} />
        </div>
      </div>

      {/* Weak-DNA guidance — shown until the voice profile is strong enough to trust */}
      {weak && (
        <section style={{ marginBlockStart: 16, display: "flex", gap: 13, alignItems: "flex-start", background: "var(--gold-tint)", border: "1px solid rgba(214,168,79,.4)", borderRadius: 16, padding: "16px 18px" }}>
          <span style={{ flex: "none", display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 10, background: "var(--gold)", color: "#fff", fontWeight: 800 }}>!</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 14.5 }}>{t("weakTitle", { pct: nf.format(dna.completion_pct) })}</div>
            <p style={{ fontSize: 13.5, color: "var(--slate)", lineHeight: 1.85, marginBlock: "6px 10px" }}>{t("weakBody")}</p>
            <Link href="/ingest" style={{ ...btnNavy, height: 38, fontSize: 13 }}>{t("weakCta")}</Link>
          </div>
        </section>
      )}

      {/* Voice + Audience + Hook/CTA + Strengths/Gaps */}
      <div className="col-2" style={{ marginBlockStart: 20 }}>
        <Card title={t("voiceTitle")} latin="Voice Profile" icon={<span style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, background: "var(--teal-tint)", color: "var(--teal-deep)" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0-11 4 4m-4-4-4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg></span>}>
          <Row k={t("vTone")}>{dna.tone_traits.join(" · ") || "—"}</Row>
          <Row k={t("vLang")}>{dna.dialect || "—"}</Row>
          <Row k={t("vExplain")}>{dna.explanation_style || "—"}</Row>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{t("vSentence")}</span>
            <SegmentMeter filled={dna.sentence_length} color="var(--teal)" label={t("vSentence")} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: "12px 2px" }}>
            <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{t("vBoldness")}</span>
            <SegmentMeter filled={dna.boldness} color="var(--gold)" label={t("vBoldness")} />
          </div>
        </Card>

        <Card title={t("audienceTitle")} latin="Audience Profile" icon={<span style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, background: "var(--blue-tint)", color: "var(--blue)" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M16 20v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg></span>}>
          <Row k={t("aPrimary")}>{dna.audience || "—"}</Row>
          <Row k={t("aAwareness")}>{dna.awareness || "—"}</Row>
          <div style={{ paddingBlockStart: 12 }}>
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginBlockEnd: 10 }}>{t("aCares")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {(dna.cares_about.length ? dna.cares_about : ["—"]).map((c, i) => (
                <span key={i} style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border-2)", color: "var(--slate)" }}>{c}</span>
              ))}
            </div>
          </div>
        </Card>

        <Card title={t("hookTitle")} latin="Hook Style">
          <DotList items={dna.hook_patterns.length ? dna.hook_patterns : ["—"]} color="var(--teal)" />
        </Card>
        <Card title={t("ctaTitle")} latin="CTA Style">
          <DotList items={dna.cta_patterns.length ? dna.cta_patterns : ["—"]} color="var(--gold)" />
        </Card>

        <Card title={t("strengthsTitle")} icon={<span style={{ color: "var(--teal-deep)", fontWeight: 800 }}>✓</span>}>
          <TintList items={dna.dos.length ? dna.dos : ["—"]} tint="var(--teal-tint-2)" fg="var(--teal-deep)" icon="✓" />
        </Card>
        <Card title={t("gapsTitle")} icon={<span style={{ color: "var(--gold-dark)", fontWeight: 800 }}>⚠</span>}>
          <TintList items={dna.donts.length ? dna.donts : ["—"]} tint="var(--gold-tint)" fg="var(--gold-dark)" icon="⚠" />
        </Card>
      </div>

      {/* Pillars */}
      <section style={{ marginBlockStart: 20, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 15 }}>{t("pillarsTitle")}</div>
          <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: "var(--font-latin)", padding: "3px 10px", borderRadius: 999, background: pillarSum === 100 ? "var(--teal-tint-2)" : "var(--gold-tint)", color: pillarSum === 100 ? "var(--teal-deep)" : "var(--gold-dark)" }}>
            Σ {nf.format(pillarSum)}%{pillarSum !== 100 ? ` — ${t("pillarsSumWarn")}` : ""}
          </span>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBlock: "6px 16px" }}>{t("pillarsSub")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,140px),1fr))", gap: 12 }}>
          {pillars.map((p) => (
            <div key={p.key} className="lift" style={{ background: p.tint, borderRadius: 14, padding: "16px 12px", textAlign: "center", border: "1px solid transparent" }}>
              <div style={{ display: "grid", placeItems: "center", width: 40, height: 40, margin: "0 auto", borderRadius: 11, background: "rgba(255,255,255,.6)", color: p.fg }}><GlyphIcon name={p.glyph} size={20} /></div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--heading)", marginBlockStart: 8 }}>{p.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: p.fg, fontFamily: "var(--font-latin)", marginBlockStart: 4 }}>{nf.format(p.pct)}%</div>
            </div>
          ))}
        </div>
      </section>

      {/* Source of each trait */}
      <TraitSources
        labels={{
          title: t("traitSrcTitle"), subtitle: t("traitSrcSub"), load: t("traitSrcLoad"), loading: t("traitSrcLoading"),
          closest: t("traitSrcClosest"), weak: t("traitSrcWeak"), none: t("traitSrcNone"),
          noKey: t("traitSrcNoKey"), noSources: t("traitSrcNoSources"), empty: t("traitSrcEmpty"),
          cat: { tone: t("vTone"), hook: t("hookTitle"), cta: t("ctaTitle"), do: t("strengthsTitle"), dont: t("gapsTitle") },
        }}
      />

      {/* Actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBlockStart: 20 }}>
        <EditDnaModal initial={editInitial} labels={editLabels} />
        <Link href="/ingest" style={btnGhost}>{t("actUpdate")}</Link>
        <Link href="/ingest" style={btnGhost}>{t("actSamples")}</Link>
        <Link href="/studio" style={btnGhost}>{t("actTry")}</Link>
        <Link href="/ingest" style={{ ...btnGhost, background: "var(--teal-tint-2)", border: "1px solid rgba(20,184,166,.3)", color: "var(--teal-deep)" }}>{t("actImprove")}</Link>
      </div>
    </main>
  );
}
