"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useNav } from "./nav-context";

function Ic({ d }: { d: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Cmd = { id: string; href: string; label: string; group: "action" | "nav"; icon: ReactNode };

/**
 * ⌘K / Ctrl+K command palette: fuzzy search over quick actions + every app
 * screen, keyboard-driven (↑ ↓ Enter Esc). Open state lives in NavProvider so
 * the top-bar search field can open it too. Keep the item list in sync with the
 * Sidebar NAV — both read the same `Nav` i18n keys.
 */
export function CommandPalette() {
  const t = useTranslations("Nav");
  const tc = useTranslations("Command");
  const router = useRouter();
  const pathname = usePathname();
  const { cmdOpen, setCmdOpen } = useNav();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global ⌘K / Ctrl+K toggles the palette; Esc closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(!cmdOpen);
      } else if (e.key === "Escape" && cmdOpen) {
        setCmdOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cmdOpen, setCmdOpen]);

  // Reset + focus whenever it opens; close on route change.
  useEffect(() => {
    if (cmdOpen) {
      setQ("");
      setActive(0);
      const id = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(id);
    }
  }, [cmdOpen]);
  useEffect(() => { setCmdOpen(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pathname]);

  const commands: Cmd[] = useMemo(
    () => [
      { id: "create", href: "/studio", label: t("createPost"), group: "action", icon: <Ic d="M12 5v14M5 12h14" /> },
      { id: "upload", href: "/ingest", label: t("ingest"), group: "action", icon: <Ic d="M12 15V3M8 7l4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /> },
      { id: "ideas", href: "/ideas", label: t("ideas"), group: "nav", icon: <Ic d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c.7.7 1 1.3 1 2h6c0-.7.3-1.3 1-2a6 6 0 0 0-4-10z" /> },
      { id: "home", href: "/dashboard", label: t("home"), group: "nav", icon: <Ic d="M3 11l9-8 9 8M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" /> },
      { id: "vault", href: "/vault", label: t("vault"), group: "nav", icon: <Ic d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /> },
      { id: "dna", href: "/dna", label: t("dna"), group: "nav", icon: <Ic d="M7 4c6 3 4 8 10 11M17 4c-6 3-4 8-10 11M8 6h8M8 18h8" /> },
      { id: "brand", href: "/brand", label: t("brand"), group: "nav", icon: <Ic d="M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7l7-4z" /> },
      { id: "plan", href: "/plan", label: t("plan"), group: "nav", icon: <Ic d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9h16M8 13h4M8 16h8" /> },
      { id: "studio", href: "/studio", label: t("studio"), group: "nav", icon: <Ic d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /> },
      { id: "media", href: "/media", label: t("media"), group: "nav", icon: <Ic d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM10 9l5 3-5 3z" /> },
      { id: "scenes", href: "/scenes", label: t("scenes"), group: "nav", icon: <Ic d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9.5a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM5.5 18a6.5 6.5 0 0 1 13 0" /> },
      { id: "distribute", href: "/distribute", label: t("distribute"), group: "nav", icon: <Ic d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 3.9M15.4 6.6l-6.8 3.9" /> },
      { id: "calendar", href: "/calendar", label: t("calendar"), group: "nav", icon: <Ic d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9h16M8 3v4M16 3v4" /> },
      { id: "approvals", href: "/approvals", label: t("approvals"), group: "nav", icon: <Ic d="M9 12l2 2 4-4M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7z" /> },
      { id: "analytics", href: "/analytics", label: t("analytics"), group: "nav", icon: <Ic d="M4 19V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM8 15l3-4 3 3 3-5" /> },
      { id: "mylink", href: "/mylink", label: t("mylink"), group: "nav", icon: <Ic d="M9 15l6-6M10 6l1-1a3.5 3.5 0 0 1 5 5l-1 1M14 18l-1 1a3.5 3.5 0 0 1-5-5l1-1" /> },
      { id: "activity", href: "/activity", label: t("activity"), group: "nav", icon: <Ic d="M3 12h4l2 6 4-14 2 8h6" /> },
      { id: "readiness", href: "/readiness", label: t("readiness"), group: "nav", icon: <Ic d="M9 11l3 3L20 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /> },
      { id: "billing", href: "/billing", label: t("billing"), group: "nav", icon: <Ic d="M3 10h18M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 15h4" /> },
      { id: "help", href: "/help", label: t("help"), group: "nav", icon: <Ic d="M9.1 9a3 3 0 1 1 4.5 2.6c-.9.5-1.6 1.3-1.6 2.4M12 17h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" /> },
      { id: "settings", href: "/settings", label: t("settings"), group: "nav", icon: <Ic d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /> },
    ],
    [t],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(term) || c.id.includes(term));
  }, [commands, q]);

  const run = (c: Cmd | undefined) => {
    if (!c) return;
    setCmdOpen(false);
    router.push(c.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); run(filtered[active]); }
  };

  // Keep the active row in view as the user arrows through.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!cmdOpen) return null;

  let cursor = -1;
  const actions = filtered.filter((c) => c.group === "action");
  const navs = filtered.filter((c) => c.group === "nav");

  const renderRow = (c: Cmd) => {
    cursor += 1;
    const idx = cursor;
    const isActive = idx === active;
    return (
      <button
        key={c.id}
        data-idx={idx}
        onClick={() => run(c)}
        onMouseMove={() => setActive(idx)}
        style={{
          display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "start",
          padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer",
          background: isActive ? "var(--teal-tint-2, var(--surface))" : "transparent",
          color: isActive ? "var(--heading)" : "var(--slate)", fontSize: 13.5, fontWeight: 500,
        }}
      >
        <span style={{ color: isActive ? "var(--teal-deep)" : "var(--muted)", display: "grid", placeItems: "center", flexShrink: 0 }}>{c.icon}</span>
        <span style={{ flex: 1 }}>{c.label}</span>
        {isActive && <span style={{ fontSize: 11, color: "var(--subtle)" }}>↵</span>}
      </button>
    );
  };

  return (
    <div onClick={() => setCmdOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(8,10,14,.55)", backdropFilter: "blur(3px)", display: "grid", placeItems: "start center", padding: "12vh 20px 20px" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={tc("title")}
        style={{ width: "100%", maxWidth: 560, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "0 30px 70px -20px rgba(0,0,0,.6)", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" stroke="var(--subtle)" strokeWidth="1.8" strokeLinecap="round" /></svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder={tc("placeholder")}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, color: "var(--heading)" }}
          />
          <kbd style={{ fontSize: 10.5, fontFamily: "var(--font-mono, monospace)", color: "var(--muted)", border: "1px solid var(--border-2)", borderRadius: 6, padding: "2px 6px" }}>ESC</kbd>
        </div>

        <div ref={listRef} className="scb" style={{ maxHeight: "min(52vh, 440px)", overflowY: "auto", padding: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "28px 12px", textAlign: "center", fontSize: 13.5, color: "var(--muted)" }}>{tc("empty")}</div>
          ) : (
            <>
              {actions.length > 0 && (
                <>
                  <div className="mono-label" style={{ padding: "8px 12px 4px", color: "var(--subtle)" }}>{tc("actions")}</div>
                  {actions.map(renderRow)}
                </>
              )}
              {navs.length > 0 && (
                <>
                  <div className="mono-label" style={{ padding: "10px 12px 4px", color: "var(--subtle)" }}>{tc("navigate")}</div>
                  {navs.map(renderRow)}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
