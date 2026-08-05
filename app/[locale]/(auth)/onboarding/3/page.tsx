import { setRequestLocale } from "next-intl/server";
import { OnboardingShell } from "../OnboardingShell";
import { Step3Form } from "./Step3Form";

// Give the worker-pump server action room to process a batch on Vercel.
export const maxDuration = 60;

export default async function OnboardingStep3({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <OnboardingShell step={3}>
      <Step3Form />
    </OnboardingShell>
  );
}
