"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type NavState = {
  open: boolean;
  setOpen: (v: boolean) => void;
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const NavCtx = createContext<NavState>({ open: false, setOpen: () => {}, collapsed: false, toggleCollapsed: () => {} });

/** Shares the mobile drawer's open/close state AND the desktop collapse state
 * between the top bar and the Sidebar. Collapse persists in localStorage (read
 * lazily so there's no server/client hook mismatch). Renders no DOM of its own,
 * so the .app-shell flex layout is preserved. */
export function NavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      try { return localStorage.getItem("athar-nav-collapsed") === "1"; } catch { /* ignore */ }
    }
    return false;
  });
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("athar-nav-collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };
  return <NavCtx.Provider value={{ open, setOpen, collapsed, toggleCollapsed }}>{children}</NavCtx.Provider>;
}

export const useNav = () => useContext(NavCtx);
