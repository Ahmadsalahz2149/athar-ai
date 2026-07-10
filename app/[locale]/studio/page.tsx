import { setRequestLocale } from "next-intl/server";
import { TopBar } from "@/components/TopBar";
import { StudioClient } from "./StudioClient";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <TopBar />
      <StudioClient />
    </>
  );
}
