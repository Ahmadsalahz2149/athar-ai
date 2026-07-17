"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { saveOnboarding, type OnboardingAnswers } from "../actions";
import { Chip, SelectableCard, btnNavy } from "@/components/ui/display";

const GOALS = ["audience", "engagement", "sell_course", "bookings", "authority", "leads", "linkedin"] as const;
const PLATFORMS = ["LinkedIn", "Instagram", "X / Twitter", "Facebook", "TikTok", "YouTube Shorts", "WhatsApp"] as const;
const FREQ = ["3w", "5w", "daily", "ai"] as const;
const STYLES = ["educational", "story", "soft_sell", "analytical", "contrarian", "short"] as const;

export function Step2Form({ initial }: { initial: OnboardingAnswers }) {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [goals, setGoals] = useState<string[]>(initial.goals ?? []);
  const [platforms, setPlatforms] = useState<string[]>(initial.platforms ?? []);
  const [frequency, setFrequency] = useState(initial.frequency ?? "");
  const [styles, setStyles] = useState<string[]>(initial.styles ?? []);
  const [pending, start] = useTransition();

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const next = () =>
    start(async () => {
      await saveOnboarding({ goals, platforms, frequency, styles });
      router.push("/onboarding/3");
    });

  return (
    <>
      <h1 style={h1}>{t("s2Title")}</h1>
      <p style={sub}>{t("s2Sub")}</p>

      <div style={section}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBlockEnd: 10 }}>
          <span style={label}>{t("s2Goals")}</span>
          <span style={{ fontSize: 12.5, color: "var(--teal-deep)", fontWeight: 600 }}>{t("s2GoalsHint")}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
          {GOALS.map((g) => (
            <SelectableCard key={g} title={t(`goal_${g}`)} active={goals.includes(g)} onClick={() => toggle(goals, setGoals, g)} />
          ))}
        </div>
      </div>

      <div style={section}>
        <div style={label}>{t("s2Platforms")}</div>
        <div style={chipWrap}>
          {PLATFORMS.map((p) => (
            <Chip key={p} active={platforms.includes(p)} onClick={() => toggle(platforms, setPlatforms, p)}>{p}</Chip>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 24, marginBlockStart: 26 }}>
        <div>
          <div style={label}>{t("s2Freq")}</div>
          <div style={{ display: "grid", gap: 10, marginBlockStart: 10 }}>
            {FREQ.map((f) => (
              <SelectableCard key={f} title={t(`freq_${f}`)} active={frequency === f} onClick={() => setFrequency(f)} />
            ))}
          </div>
        </div>
        <div>
          <div style={label}>{t("s2Style")}</div>
          <div style={{ ...chipWrap, marginBlockStart: 10 }}>
            {STYLES.map((s) => (
              <Chip key={s} active={styles.includes(s)} onClick={() => toggle(styles, setStyles, s)}>{t(`style_${s}`)}</Chip>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "var(--border)", marginBlock: "30px 20px" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button onClick={next} disabled={pending} style={{ ...btnNavy, height: 48, padding: "0 26px", fontSize: 14.5, opacity: pending ? 0.7 : 1 }}>
          {t("next")} ←
        </button>
        <button onClick={() => router.push("/onboarding/1")} style={{ background: "none", border: "none", fontSize: 13.5, color: "var(--muted)", cursor: "pointer" }}>
          {t("back")}
        </button>
      </div>
    </>
  );
}

const h1: React.CSSProperties = { fontSize: "clamp(24px,3.4vw,30px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" };
const sub: React.CSSProperties = { fontSize: 15, color: "var(--muted)", lineHeight: 1.8, marginBlock: "8px 8px" };
const section: React.CSSProperties = { marginBlockStart: 26 };
const label: React.CSSProperties = { fontSize: 14.5, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 10 };
const chipWrap: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 9 };
