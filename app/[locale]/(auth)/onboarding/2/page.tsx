import { setRequestLocale } from "next-intl/server";
import { OnboardingShell } from "../OnboardingShell";
import { getOnboarding } from "../actions";
import { Step2Form } from "./Step2Form";

export default async function OnboardingStep2({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const initial = await getOnboarding();
  return (
    <OnboardingShell step={2}>
      <Step2Form initial={initial} />
    </OnboardingShell>
  );
}
