import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { routing } from "@/i18n/routing";
import "../globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: "أثر AI — Athar",
  description: "Personal Brand Growth OS",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const dir = locale === "ar" ? "rtl" : "ltr";
  const fontFamily = locale === "ar" ? "var(--font-ar)" : "var(--font-latin)";

  return (
    <html lang={locale} dir={dir} className={`${plexArabic.variable} ${inter.variable}`}>
      <body style={{ fontFamily, minHeight: "100vh" }}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
