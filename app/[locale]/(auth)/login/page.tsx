import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AuthForm } from "./AuthForm";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Spec acceptance: authenticated users skip straight to the Dashboard.
  const supabase = await getSupabaseServer();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(`/${locale === "en" ? "en" : "ar"}/dashboard`);
  }

  return <AuthForm />;
}
