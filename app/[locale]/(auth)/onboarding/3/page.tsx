import { setRequestLocale } from "next-intl/server";
import { OnboardingShell } from "../OnboardingShell";
import { Step3Form } from "./Step3Form";

export default async function OnboardingStep3({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <OnboardingShell step={3}>
      <Step3Form />
    </OnboardingShell>
  );
}
