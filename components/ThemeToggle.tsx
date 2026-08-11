"use client";

import { useEffect, useState } from "react";

/** Dark/light toggle. Dark is the default; the choice persists in localStorage
 * and is applied pre-paint by the inline script in the root layout. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = (() => {
      try { return localStorage.getItem("athar-theme"); } catch { return null; }
    })();
    setTheme(stored === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    const root = document.documentElement;
    if (next === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try { localStorage.setItem("athar-theme", next); } catch { /* ignore */ }
  };

  const size = compact ? 32 : 36;
  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
      title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
      style={{
        width: size, height: size, borderRadius: 10, cursor: "pointer",
        display: "grid", placeItems: "center", flexShrink: 0,
        border: "1px solid var(--border)", background: "transparent", color: "var(--muted)",
      }}
    >
      {theme === "dark" ? (
        // sun
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      ) : (
        // moon
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
