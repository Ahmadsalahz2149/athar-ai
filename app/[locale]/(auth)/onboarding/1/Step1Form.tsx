"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { saveOnboarding, type OnboardingAnswers } from "../actions";
import { Chip, SelectableCard, btnNavy } from "@/components/ui/display";

const FIELDS = ["entrepreneurship", "education", "health", "realestate", "training", "ai", "marketing"] as const;
const AUDIENCES = ["creators", "coaches", "employees", "students", "founders", "beginners"] as const;
const BRAND_TYPES = ["consultant", "coach", "expert", "agency", "creator", "course_owner"] as const;
const DIALECTS = ["english", "egyptian", "gulf", "saudi", "msa"] as const;

export function Step1Form({ initial }: { initial: OnboardingAnswers }) {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [field, setField] = useState(initial.field ?? "");
  const [audience, setAudience] = useState(initial.audience ?? "");
  const [brandType, setBrandType] = useState(initial.brandType ?? "");
  const [dialect, setDialect] = useState(initial.dialect ?? "");
  const [pending, start] = useTransition();
  const [showErr, setShowErr] = useState(false);
  const [saveErr, setSaveErr] = useState(false);

  const valid = !!field && !!audience && !!brandType && !!dialect;
  const next = () => {
    if (!valid) { setShowErr(true); return; }
    start(async () => {
      setSaveErr(false);
      const result = await saveOnboarding({ field, audience, brandType, dialect });
      if (!result.ok) {
        setSaveErr(true);
        if (result.error === "no_session") router.replace("/signup");
        return;
      }
      router.push("/onboarding/2");
    });
  };

  return (
    <>
      <h1 style={h1}>{t("s1Title")}</h1>
      <p style={sub}>{t("s1Sub")}</p>

      <div style={section}>
        <div style={label}>{t("s1Field")}</div>
        <div style={chipWrap}>
          {FIELDS.map((f) => (
            <Chip key={f} active={field === f} onClick={() => setField(f)}>{t(`field_${f}`)}</Chip>
          ))}
        </div>
      </div>

      <div style={section}>
        <div style={label}>{t("s1Audience")}</div>
        <div style={chipWrap}>
          {AUDIENCES.map((a) => (
            <Chip key={a} active={audience === a} onClick={() => setAudience(a)}>{t(`aud_${a}`)}</Chip>
          ))}
        </div>
      </div>

      <div style={section}>
        <div style={label}>{t("s1BrandType")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,210px),1fr))", gap: 12, marginBlockStart: 10 }}>
          {BRAND_TYPES.map((b) => (
            <SelectableCard key={b} title={t(`bt_${b}`)} desc={t(`btd_${b}`)} active={brandType === b} onClick={() => setBrandType(b)} />
          ))}
        </div>
      </div>

      <div style={section}>
        <div style={label}>{t("s1Dialect")}</div>
        <div style={chipWrap}>
          {DIALECTS.map((d) => (
            <Chip key={d} active={dialect === d} onClick={() => setDialect(d)}>{t(`dia_${d}`)}</Chip>
          ))}
        </div>
      </div>

      {showErr && !valid && (
        <p style={{ marginBlockStart: 20, padding: "10px 14px", borderRadius: 11, background: "var(--coral-tint)", color: "var(--coral)", fontSize: 13.5 }}>{t("selectAllHint")}</p>
      )}
      {saveErr && <p role="alert" style={errorBox}>{t("saveError")}</p>}

      <div style={{ height: 1, background: "var(--border)", marginBlock: "30px 20px" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button onClick={next} disabled={pending} style={{ ...btnNavy, height: 48, padding: "0 26px", fontSize: 14.5, opacity: pending ? 0.7 : !valid ? 0.85 : 1 }}>
          {t("next")} ←
        </button>
        <button onClick={() => router.push("/signup")} style={{ background: "none", border: "none", fontSize: 13.5, color: "var(--muted)", cursor: "pointer" }}>{t("back")}</button>
      </div>
    </>
  );
}

const h1: React.CSSProperties = { fontSize: "clamp(24px,3.4vw,30px)", fontWeight: 700, color: "var(--heading)", letterSpacing: "-.4px" };
const sub: React.CSSProperties = { fontSize: 15, color: "var(--muted)", lineHeight: 1.8, marginBlock: "8px 8px" };
const section: React.CSSProperties = { marginBlockStart: 26 };
const label: React.CSSProperties = { fontSize: 14.5, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 10 };
const chipWrap: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 9 };
const errorBox: React.CSSProperties = { marginBlockStart: 20, padding: "10px 14px", borderRadius: 11, background: "var(--coral-tint)", color: "var(--coral)", fontSize: 13.5 };
