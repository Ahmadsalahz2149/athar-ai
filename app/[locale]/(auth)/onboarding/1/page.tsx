import { setRequestLocale } from "next-intl/server";
import { OnboardingShell } from "../OnboardingShell";
import { getOnboarding } from "../actions";
import { Step1Form } from "./Step1Form";
import { redirect } from "next/navigation";

export default async function OnboardingStep1({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const initial = await getOnboarding();
  if (!initial) redirect(`/${locale === "en" ? "en" : "ar"}/signup`);
  return (
    <OnboardingShell step={1}>
      <Step1Form initial={initial} />
    </OnboardingShell>
  );
}
