import { LegalShell } from "@/components/LegalShell";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalShell locale={locale} titleKey="privacyTitle" />;
}
