import type { MetadataRoute } from "next";

/** PWA manifest — makes Athar installable on mobile/desktop with an on-brand icon
 * and a standalone (app-like) window. Served at /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "أثر AI — Athar",
    short_name: "أثر",
    description: "منصة نمو العلامة الشخصية بالذكاء الاصطناعي — تعلّم صوتك واكتب بأسلوبك.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f9fafb",
    theme_color: "#0f766e",
    dir: "rtl",
    lang: "ar",
    categories: ["business", "productivity", "marketing"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
