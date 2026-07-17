import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/Logo";

/** Slim header + 3-segment progress used by all onboarding steps (per design). */
export async function OnboardingShell({ step, children }: { step: 1 | 2 | 3; children: ReactNode }) {
  const t = await getTranslations("Onboarding");
  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)" }}>
      <header
        style={{
          height: 66,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 clamp(16px,4vw,32px)",
        }}
      >
        <Link href="/dashboard" style={{ fontSize: 13.5, color: "var(--muted)", fontWeight: 600 }}>
          {t("skip")}
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontWeight: 700, fontSize: 15.5, color: "var(--heading)" }}>
            أثر <span style={{ color: "var(--teal-deep)" }}>AI</span>
          </span>
          <Logo size={34} />
        </div>
      </header>

      <main style={{ maxWidth: 780, margin: "0 auto", padding: "clamp(12px,3vw,26px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBlockEnd: 30 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--teal-deep)", whiteSpace: "nowrap" }}>
            {t("stepOf", { n: step })}
          </span>
          <div style={{ display: "flex", gap: 8, flex: 1 }}>
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 5,
                  background: s <= step ? "var(--teal)" : "var(--border-2)",
                }}
              />
            ))}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
