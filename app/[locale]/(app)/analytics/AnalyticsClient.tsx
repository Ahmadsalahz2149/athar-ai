"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StatCard, Chip, btnTeal } from "@/components/ui/display";

type Range = "r7" | "r30" | "r3m";
type Top = { hook: string; platform: string; score: number };

// Sample datasets per range (clearly labelled). Real numbers need publishing+OAuth.
const DATA: Record<Range, { reach: string; eng: string; fol: string; rate: string; rateNeg: boolean; bars: number[] }> = {
  r7: { reach: "9.8K", eng: "720", fol: "88+", rate: "6.1%", rateNeg: false, bars: [55, 70, 62, 80, 95] },
  r30: { reach: "48.2K", eng: "3,940", fol: "620+", rate: "5.8%", rateNeg: true, bars: [40, 62, 55, 78, 90, 72] },
  r3m: { reach: "142K", eng: "11.2K", fol: "1,840+", rate: "6.4%", rateNeg: false, bars: [30, 48, 60, 55, 72, 85, 78, 96] },
};
const PLATFORM_SPLIT = [
  { name: "LinkedIn", pct: 58, color: "var(--blue)" },
  { name: "X / Twitter", pct: 27, color: "#111" },
  { name: "Instagram", pct: 15, color: "var(--gold)" },
];
const TYPES = [
  { key: "story", pct: 42, color: "var(--teal)" },
  { key: "educational", pct: 31, color: "var(--blue)" },
  { key: "analytical", pct: 16, color: "var(--gold)" },
  { key: "sell", pct: 11, color: "var(--coral)" },
];

function Donut({ segs }: { segs: { pct: number; color: string }[] }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const withOffsets = segs.reduce<{ pct: number; color: string; offset: number }[]>((acc, s) => {
    const prev = acc.length ? acc[acc.length - 1] : null;
    const offset = prev ? prev.offset + (prev.pct / 100) * c : 0;
    return [...acc, { ...s, offset }];
  }, []);
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={segs.map((s) => `${s.pct}%`).join(", ")}>
      {withOffsets.map((s, i) => {
        const len = (s.pct / 100) * c;
        return <circle key={i} cx="48" cy="48" r={r} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-s.offset} transform="rotate(-90 48 48)" />;
      })}
    </svg>
  );
}

function SampleTag({ label }: { label: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--gold-tint)", color: "var(--gold-dark)" }}>{label}</span>;
}

export function AnalyticsClient({ topPosts, hasContent }: { topPosts: Top[]; hasContent: boolean }) {
  const t = useTranslations("Analytics");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const [range, setRange] = useState<Range>("r30");
  const d = DATA[range];
  const max = Math.max(...d.bars);

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBlockEnd: 16, alignItems: "center", flexWrap: "wrap" }}>
        {(["r7", "r30", "r3m"] as Range[]).map((r) => (
          <Chip key={r} variant="fill" size="sm" active={range === r} onClick={() => setRange(r)}>{t(r)}</Chip>
        ))}
        <span style={{ marginInlineStart: 4, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 999, background: "var(--gold-tint)", color: "var(--gold-dark)" }}>⚠ {t("sampleBadge")}</span>
      </div>

      {/* KPIs — sample */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 14 }}>
        <div style={{ position: "relative" }}><span style={{ position: "absolute", insetInlineEnd: 10, insetBlockStart: 10, zIndex: 1 }}><SampleTag label={t("sample")} /></span><StatCard label={t("reach")} value={d.reach} delta="+18%" tint="var(--teal-tint)" icon={<Eye />} /></div>
        <div style={{ position: "relative" }}><span style={{ position: "absolute", insetInlineEnd: 10, insetBlockStart: 10, zIndex: 1 }}><SampleTag label={t("sample")} /></span><StatCard label={t("engagement")} value={d.eng} delta="+24%" tint="var(--coral-tint)" icon={<Heart />} /></div>
        <div style={{ position: "relative" }}><span style={{ position: "absolute", insetInlineEnd: 10, insetBlockStart: 10, zIndex: 1 }}><SampleTag label={t("sample")} /></span><StatCard label={t("followers")} value={d.fol} delta="+9%" tint="var(--blue-tint)" icon={<User />} /></div>
        <div style={{ position: "relative" }}><span style={{ position: "absolute", insetInlineEnd: 10, insetBlockStart: 10, zIndex: 1 }}><SampleTag label={t("sample")} /></span><StatCard label={t("rate")} value={d.rate} delta={d.rateNeg ? "-0.4%" : "+0.6%"} deltaNegative={d.rateNeg} tint="var(--gold-tint)" icon={<Pulse />} /></div>
      </div>

      <div className="col2 narrow-first" style={{ marginBlockStart: 20 }}>
        {/* Left: platform + types (sample) */}
        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <section style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={cardTitle}>{t("byPlatform")}</span><SampleTag label={t("sample")} /></div>
            <div style={{ display: "grid", gap: 12, marginBlockStart: 12 }}>
              {PLATFORM_SPLIT.map((p) => (
                <div key={p.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--slate)", marginBlockEnd: 5 }}><span>{p.name}</span><span style={{ fontFamily: "var(--font-latin)", fontWeight: 700 }}>{p.pct}%</span></div>
                  <div style={{ height: 8, borderRadius: 8, background: "var(--border-3)", overflow: "hidden" }} role="img" aria-label={`${p.name} ${p.pct}%`}><div style={{ width: `${p.pct}%`, height: "100%", background: p.color }} /></div>
                </div>
              ))}
            </div>
          </section>
          <section style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={cardTitle}>{t("contentTypes")}</span><SampleTag label={t("sample")} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginBlockStart: 14, flexWrap: "wrap" }}>
              <Donut segs={TYPES} />
              <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 120 }}>
                {TYPES.map((ty) => (
                  <div key={ty.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)" }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: ty.color }} /><span style={{ fontFamily: "var(--font-latin)", fontWeight: 700 }}>{ty.pct}%</span><span>{t(`ty_${ty.key}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Right: chart + insight + top posts (REAL) */}
        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <section style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBlockEnd: 16 }}>
              <span style={cardTitle}>{t("engagementOverTime")}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}><SampleTag label={t("sample")} /><span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-deep)", padding: "4px 10px", borderRadius: 999, background: "var(--teal-tint-2)" }}>{t("trendUp")} ↗</span></div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 150 }} role="img" aria-label={t("engagementOverTime")}>
              {d.bars.map((b, i) => {
                const last = i === d.bars.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: "grid", justifyItems: "center", gap: 6 }}>
                    <div style={{ width: "100%", height: `${(b / max) * 120}px`, background: last ? "linear-gradient(180deg,var(--gold),var(--gold-dark))" : "linear-gradient(180deg,var(--teal),var(--teal-dark))", borderRadius: "6px 6px 0 0" }} />
                    <span style={{ fontSize: 10.5, fontWeight: last ? 800 : 500, color: last ? "var(--heading)" : "var(--subtle)" }}>{t("week", { n: nf.format(i + 1) })}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <div style={{ background: "linear-gradient(160deg,#102A43,#0B1F33)", color: "#fff", borderRadius: 18, padding: 22 }}>
            <div style={{ fontSize: 12.5, color: "var(--teal-light)", fontWeight: 700, marginBlockEnd: 8 }}>✦ {t("whatWorks")}</div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.8, marginBlockEnd: 16 }}>{t("insightBody")}</div>
            <Link href="/dna" style={btnTeal}>{t("updateDna")}</Link>
          </div>

          <section style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={cardTitle}>{t("topPosts")}</span><span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--teal-tint-2)", color: "var(--teal-deep)" }}>{t("real")}</span></div>
            {hasContent && topPosts.length > 0 ? (
              <div style={{ display: "grid", gap: 10, marginBlockStart: 12 }}>
                {topPosts.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span style={{ width: 26, height: 26, flex: "none", borderRadius: 8, display: "grid", placeItems: "center", background: i === 0 ? "var(--gold)" : "var(--border-3)", color: i === 0 ? "#3a2b0c" : "var(--slate-2)", fontWeight: 800, fontSize: 12, fontFamily: "var(--font-latin)" }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, color: "var(--heading)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.hook}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)" }}>{p.platform}</span>
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>{nf.format(p.score)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--muted)", marginBlockStart: 10 }}>{t("noTopPosts")}</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 };
const cardTitle: React.CSSProperties = { fontWeight: 700, color: "var(--heading)", fontSize: 15 };
const Eye = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="var(--teal-deep)" strokeWidth="1.7" /><circle cx="12" cy="12" r="3" stroke="var(--teal-deep)" strokeWidth="1.7" /></svg>;
const Heart = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6 5c2 0 3.2 1.2 4 2.5C10.8 6.2 12 5 14 5c3.5 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z" stroke="var(--coral)" strokeWidth="1.6" /></svg>;
const User = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" stroke="var(--blue)" strokeWidth="1.6" strokeLinecap="round" /></svg>;
const Pulse = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 12h4l3 8 4-16 3 8h4" stroke="var(--gold-dark)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
