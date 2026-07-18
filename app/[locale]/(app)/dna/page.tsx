import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import type { ContentDna } from "@/lib/ai/prompts";
import { ScoreRadial, SegmentMeter, EmptyState, btnNavy, btnGhost } from "@/components/ui/display";

const PILLAR_META = [
  { key: "educational", emoji: "📚", tint: "var(--gold-tint)", fg: "var(--gold-dark)" },
  { key: "story", emoji: "📖", tint: "var(--teal-tint-2)", fg: "var(--teal-deep)" },
  { key: "proof", emoji: "🏆", tint: "var(--blue-tint)", fg: "var(--blue)" },
  { key: "soft_sell", emoji: "💼", tint: "var(--coral-tint)", fg: "var(--coral)" },
  { key: "thought_leadership", emoji: "💡", tint: "#F3ECFB", fg: "#7C3AED" },
  { key: "engagement", emoji: "💬", tint: "var(--border-3)", fg: "var(--slate-2)" },
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
  if (db) {
    const ctx = await currentContext();
    if (ctx) dna = await forOrg(db, ctx.orgId).currentDna(ctx.brandId);
  }

  if (!dna) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "clamp(40px,8vw,90px) clamp(16px,4vw,32px)", textAlign: "center", animation: "floatUp .4s ease" }}>
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} cta={<Link href="/onboarding/1" style={btnNavy}>{t("buildNow")}</Link>} />
      </main>
    );
  }

  const pillars = PILLAR_META.map((p) => ({ ...p, label: t(`pillar_${p.key}`), pct: dna!.pillars[p.key] }));

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
          </div>
          <ScoreRadial value={dna.completion_pct} size={104} suffix="%" caption={t("completeness")} track="rgba(255,255,255,.14)" valueColor="#fff" />
        </div>
      </div>

      {/* Voice + Audience + Hook/CTA + Strengths/Gaps */}
      <div className="col-2" style={{ marginBlockStart: 20 }}>
        <Card title={t("voiceTitle")} latin="Voice Profile" icon={<span style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, background: "var(--teal-tint)", color: "var(--teal-deep)" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0-11 4 4m-4-4-4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg></span>}>
          <Row k={t("vTone")}>{dna.tone_traits.join(" · ") || "—"}</Row>
          <Row k={t("vLang")}>{dna.dialect || "—"}</Row>
          <Row k={t("vExplain")}>{dna.explanation_style || "—"}</Row>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{t("vSentence")}</span>
            <SegmentMeter filled={dna.sentence_length} color="var(--teal)" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: "12px 2px" }}>
            <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{t("vBoldness")}</span>
            <SegmentMeter filled={dna.boldness} color="var(--gold)" />
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
        <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 15 }}>{t("pillarsTitle")}</div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBlock: "6px 16px" }}>{t("pillarsSub")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
          {pillars.map((p) => (
            <div key={p.key} style={{ background: p.tint, borderRadius: 14, padding: "16px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 24 }}>{p.emoji}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--heading)", marginBlockStart: 6 }}>{p.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: p.fg, fontFamily: "var(--font-latin)", marginBlockStart: 4 }}>{nf.format(p.pct)}%</div>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBlockStart: 20 }}>
        <Link href="/ingest" style={btnNavy}>{t("actUpdate")}</Link>
        <Link href="/ingest" style={btnGhost}>{t("actSamples")}</Link>
        <Link href="/studio" style={btnGhost}>{t("actTry")}</Link>
        <Link href="/ingest" style={{ ...btnGhost, background: "var(--teal-tint-2)", border: "1px solid rgba(20,184,166,.3)", color: "var(--teal-deep)" }}>{t("actImprove")}</Link>
      </div>
    </main>
  );
}
