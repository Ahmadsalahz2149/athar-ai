import { setRequestLocale } from "next-intl/server";
import { OnboardingShell } from "../OnboardingShell";
import { getOnboarding } from "../actions";
import { Step2Form } from "./Step2Form";
import { redirect } from "next/navigation";

export default async function OnboardingStep2({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const initial = await getOnboarding();
  if (!initial) redirect(`/${locale === "en" ? "en" : "ar"}/signup`);
  return (
    <OnboardingShell step={2}>
      <Step2Form initial={initial} />
    </OnboardingShell>
  );
}
