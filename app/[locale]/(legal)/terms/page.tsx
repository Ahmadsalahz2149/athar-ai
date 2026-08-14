import { LegalShell } from "@/components/LegalShell";
import { legalContent } from "../legal-content";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalShell locale={locale} titleKey="termsTitle" doc={legalContent(locale).terms} />;
}
