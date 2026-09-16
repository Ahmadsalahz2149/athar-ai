"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Registers the service worker, and offers an "Install app" chip — but only to
 * someone already inside the product.
 *
 * Chrome fires `beforeinstallprompt` on whatever page it likes, which meant the
 * chip appeared on the landing page and over the sign-in form: asking a visitor
 * to put an app on their phone before they know what it is, while covering the
 * thing they came to read. An install offer is a reasonable ask AFTER the
 * product has been useful, and an interruption before.
 *
 * iOS installs via the Share sheet and fires no event, so the chip never shows
 * there — by the platform's design, not ours.
 */

/** Public and auth routes: the visitor has not seen the product yet. */
function isPublicRoute(pathname: string): boolean {
  const p = pathname.replace(/^\/(ar|en)(?=\/|$)/, "") || "/";
  if (p === "/") return true;
  return ["/login", "/signup", "/forgot-password", "/reset-password", "/invite", "/onboarding",
          "/terms", "/privacy", "/refund", "/l/", "/r/", "/data-deletion"]
    .some((prefix) => p === prefix || p.startsWith(`${prefix}/`) || p.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}
export function PwaRegister() {
  const t = useTranslations("Pwa");
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      try {
        // localStorage, not session: "no thanks" should mean no thanks, not
        // "ask me again in an hour".
        if (localStorage.getItem("athar-install-dismissed")) return;
      } catch {
        /* a private window can throw on access; the chip is not worth failing over */
      }
      setDeferred(e as InstallEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // The event may have fired while the person was still on a public page; keep
  // it and show the chip once they are inside rather than discarding the offer.
  if (!deferred || dismissed || isPublicRoute(pathname)) return null;

  const install = async () => {
    const e = deferred;
    setDeferred(null);
    await e.prompt();
    await e.userChoice.catch(() => {});
  };
  const close = () => {
    setDismissed(true);
    try { localStorage.setItem("athar-install-dismissed", "1"); } catch { /* ignore */ }
  };

  return (
    <div
      style={{
        position: "fixed", insetBlockEnd: 20, insetInlineStart: 20, zIndex: 55,
        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 10px 14px",
        borderRadius: 14, background: "var(--card,#fff)", border: "1px solid var(--teal)",
        boxShadow: "0 10px 30px rgba(11,31,51,.18)", maxWidth: "calc(100vw - 40px)",
      }}
      className="lift"
    >
      <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: "linear-gradient(160deg,var(--teal),var(--teal-deep,#0f766e))", color: "#fff", fontSize: 17 }}>✦</span>
      <div style={{ fontSize: 12.8, fontWeight: 600, color: "var(--heading)", lineHeight: 1.5 }}>{t("prompt")}</div>
      <button onClick={install} style={{ height: 32, padding: "0 14px", borderRadius: 9, border: "none", cursor: "pointer", background: "var(--teal)", color: "#fff", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>{t("install")}</button>
      <button onClick={close} aria-label={t("later")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>
    </div>
  );
}
