import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono, Inter } from "next/font/google";
import { routing } from "@/i18n/routing";
import { PwaRegister } from "@/components/PwaRegister";
import "../globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

// Monospace face for the signature uppercase micro-labels (Latin/numbers).
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
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
  metadataBase: new URL(process.env.OAUTH_BASE_URL || "https://athargrowth.com"),
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
  themeColor: "#131011",
};

// Set the theme before first paint to avoid a flash. Dark is the default; only
// an explicit stored "light" choice overrides it.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('athar-theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

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
    <html lang={locale} dir={dir} className={`${plexArabic.variable} ${plexMono.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body style={{ fontFamily, minHeight: "100vh" }} suppressHydrationWarning>
        <NextIntlClientProvider>
          {children}
          <PwaRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
