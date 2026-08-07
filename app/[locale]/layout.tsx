import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { IBM_Plex_Sans_Arabic, Inter, Rubik } from "next/font/google";
import { routing } from "@/i18n/routing";
import { PwaRegister } from "@/components/PwaRegister";
import "../globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

// Display face for headings — confident geometric, real Arabic support; gives
// the product a distinctive voice vs the Plex/Inter default.
const rubik = Rubik({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
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
  applicationName: "أثر AI",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "أثر" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
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
    <html lang={locale} dir={dir} className={`${plexArabic.variable} ${rubik.variable} ${inter.variable}`}>
      <body style={{ fontFamily, minHeight: "100vh" }} suppressHydrationWarning>
        <NextIntlClientProvider>
          {children}
          <PwaRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
