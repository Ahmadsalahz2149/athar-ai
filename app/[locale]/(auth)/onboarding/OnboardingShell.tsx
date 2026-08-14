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
        {/* Numbered stepper: done → checkmark, current → filled, upcoming → outline. */}
        <div style={{ display: "flex", alignItems: "flex-start", marginBlockEnd: 34 }}>
          {([1, 2, 3] as const).map((s, idx) => {
            const done = s < step;
            const current = s === step;
            const label = t(`stepLabel${s}`);
            return (
              <div key={s} style={{ display: "contents" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: "none", width: 76 }}>
                  <span
                    aria-current={current ? "step" : undefined}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 13.5,
                      fontWeight: 700,
                      fontFamily: "var(--font-latin)",
                      flex: "none",
                      background: done || current ? "var(--teal)" : "transparent",
                      color: done || current ? "#fff" : "var(--muted)",
                      border: done || current ? "none" : "1.5px solid var(--border-2)",
                      boxShadow: current ? "0 0 0 4px var(--teal-tint-2)" : "none",
                      transition: "all .2s ease",
                    }}
                  >
                    {done ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    ) : (
                      s
                    )}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: current ? 700 : 600, color: current ? "var(--heading)" : "var(--muted)", whiteSpace: "nowrap", textAlign: "center" }}>{label}</span>
                </div>
                {idx < 2 && (
                  <span style={{ flex: 1, height: 2, borderRadius: 2, marginBlockStart: 16, background: s < step ? "var(--teal)" : "var(--border-2)", transition: "background .2s ease" }} />
                )}
              </div>
            );
          })}
        </div>
        {children}
      </main>
    </div>
  );
}
