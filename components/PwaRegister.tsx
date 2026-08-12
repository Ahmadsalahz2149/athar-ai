"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Registers the service worker and offers a subtle "Install app" chip when the
 * browser fires beforeinstallprompt (Android/desktop Chrome). iOS installs via
 * the Share sheet, so no prompt fires there — the chip simply won't show. */
export function PwaRegister() {
  const t = useTranslations("Pwa");
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      try {
        if (sessionStorage.getItem("athar-install-dismissed")) return;
      } catch {
        /* ignore */
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

  if (!deferred || dismissed) return null;

  const install = async () => {
    const e = deferred;
    setDeferred(null);
    await e.prompt();
    await e.userChoice.catch(() => {});
  };
  const close = () => {
    setDismissed(true);
    try { sessionStorage.setItem("athar-install-dismissed", "1"); } catch { /* ignore */ }
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
