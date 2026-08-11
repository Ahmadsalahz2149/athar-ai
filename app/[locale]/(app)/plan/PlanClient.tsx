"use client";

import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { GlyphIcon, btnTeal, btnGhost } from "@/components/ui/display";
import type { MonthlyPlan, PlanItem } from "@/lib/plan/types";
import { generateMonthlyPlan } from "./actions";

export type Occasion = { label: string; month: number; day: number; tag: string };

const cardStyle: CSSProperties = { background: "var(--surface,#fff)", border: "1px solid var(--border)", borderRadius: 16, padding: "clamp(16px,2.4vw,22px)", marginBlockEnd: 16 };

const PILLAR_TINT: Record<string, { bg: string; fg: string }> = {
  educational: { bg: "var(--gold-tint)", fg: "var(--gold-dark)" },
  story: { bg: "var(--teal-tint-2,#e6f7f4)", fg: "var(--teal-deep,#0f766e)" },
  proof: { bg: "var(--blue-tint)", fg: "var(--blue)" },
  soft_sell: { bg: "var(--coral-tint)", fg: "var(--coral)" },
  thought_leadership: { bg: "#F3ECFB", fg: "#7C3AED" },
  engagement: { bg: "var(--border-3,#eef1f5)", fg: "var(--slate-2)" },
};
const TAG_TINT: Record<string, { bg: string; fg: string }> = {
  intl: { bg: "var(--blue-tint)", fg: "var(--blue)" },
  business: { bg: "var(--gold-tint)", fg: "var(--gold-dark)" },
  tech: { bg: "#F3ECFB", fg: "#7C3AED" },
  social: { bg: "var(--teal-tint-2,#e6f7f4)", fg: "var(--teal-deep,#0f766e)" },
  gulf: { bg: "var(--coral-tint)", fg: "var(--coral)" },
};

function Section({ glyph, title, desc, action, children }: { glyph: string; title: string; desc?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section style={cardStyle} className="lift">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBlockEnd: 14 }}>
        <span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, background: "var(--teal-tint,#e6f7f4)", color: "var(--teal)", flexShrink: 0 }}>
          <GlyphIcon name={glyph} size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--heading)" }}>{title}</div>
          {desc && <div style={{ fontSize: 12.8, color: "var(--muted)", marginBlockStart: 2 }}>{desc}</div>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PlanClient({ plan, month, monthName, occasions, hasDna, locale }: { plan: MonthlyPlan; month: string; monthName: string; occasions: Occasion[]; hasDna: boolean; locale: string }) {
  const t = useTranslations("Plan");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const hasPlan = plan.plan.length > 0;
  const nf = useMemo(() => new Intl.NumberFormat(locale === "ar" ? "ar" : "en"), [locale]);

  const generate = () =>
    start(async () => {
      setErr("");
      const r = await generateMonthlyPlan(month);
      if (!r.ok) setErr(r.error === "no_dna" ? t("errNoDna") : r.error === "insufficient_credits" ? t("errCredits") : r.error === "no_key" ? t("errNoKey") : t("errGeneric"));
      else router.refresh();
    });

  const studioHref = (title: string) => `/studio?prompt=${encodeURIComponent(title)}`;

  return (
    <div>
      {/* Monthly plan */}
      <Section
        glyph="chart"
        title={t("planTitle", { month: monthName })}
        desc={t("planDesc")}
        action={<button onClick={generate} disabled={pending || !hasDna} style={{ ...btnTeal, height: 36, fontSize: 12.5, whiteSpace: "nowrap" }}>{pending ? t("generating") : hasPlan ? t("regenerate") : t("generate")}</button>}
      >
        {!hasDna && <div style={{ fontSize: 12.8, color: "var(--gold-dark)" }}>{t("needDna")}</div>}
        {err && <div style={{ fontSize: 12.8, color: "var(--danger,#dc2626)", marginBlockEnd: 10 }}>{err}</div>}
        {hasDna && !hasPlan && !err && <div style={{ fontSize: 12.8, color: "var(--muted)" }}>{t("planEmpty")}</div>}

        {hasPlan && (
          <div style={{ display: "grid", gap: 8 }}>
            {plan.plan.map((it: PlanItem, i) => {
              const tone = PILLAR_TINT[it.pillar] ?? PILLAR_TINT.educational;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", flexWrap: "wrap" }}>
                  <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 10, background: "var(--navy,var(--navy-2))", color: "#fff", flexShrink: 0, lineHeight: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--font-latin)" }}>{nf.format(it.day)}</span>
                  </span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "var(--heading)" }}>{it.title}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: tone.bg, color: tone.fg }}>{t(`pillar_${it.pillar}`)}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--subtle)" }}>{t(`format_${it.format}`)}</span>
                    </div>
                    {it.angle && <div style={{ fontSize: 12.5, color: "var(--muted)", marginBlockStart: 3 }}>{it.angle}</div>}
                  </div>
                  <Link href={studioHref(it.title)} style={{ ...btnGhost, height: 32, fontSize: 12 }}>{t("write")}</Link>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Trends */}
      <Section glyph="flame" title={t("trendsTitle")} desc={t("trendsDesc")}>
        {plan.trends.length === 0 ? (
          <div style={{ fontSize: 12.8, color: "var(--muted)" }}>{hasPlan ? t("trendsEmpty") : t("trendsGenerateHint")}</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {plan.trends.map((tr, i) => (
              <Link key={i} href={studioHref(tr)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", textDecoration: "none", color: "var(--heading)" }}>
                <span style={{ color: "var(--coral)" }}><GlyphIcon name="flame" size={16} /></span>
                <span style={{ flex: 1, fontSize: 13.5 }}>{tr}</span>
                <span style={{ color: "var(--teal)", fontSize: 12.5 }}>{t("write")} ←</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* World days */}
      <Section glyph="target" title={t("occasionsTitle")} desc={t("occasionsDesc")}>
        <div style={{ display: "grid", gap: 8 }}>
          {occasions.map((o, i) => {
            const tone = TAG_TINT[o.tag] ?? TAG_TINT.social;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", flexWrap: "wrap" }}>
                <span style={{ display: "grid", placeItems: "center", minWidth: 46, height: 40, borderRadius: 10, background: tone.bg, color: tone.fg, flexShrink: 0, padding: "0 8px", fontSize: 12, fontWeight: 700, textAlign: "center" }}>
                  {nf.format(o.day)}/{nf.format(o.month)}
                </span>
                <span style={{ flex: 1, minWidth: 140, fontWeight: 600, fontSize: 14, color: "var(--heading)" }}>{o.label}</span>
                <Link href={studioHref(o.label)} style={{ ...btnGhost, height: 32, fontSize: 12 }}>{t("writePost")}</Link>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
