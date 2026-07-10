import { setRequestLocale } from "next-intl/server";
import { OnboardingClient } from "./OnboardingClient";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OnboardingClient />;
}
