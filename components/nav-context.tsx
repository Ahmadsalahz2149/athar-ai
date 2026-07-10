"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type NavState = { open: boolean; setOpen: (v: boolean) => void };

const NavCtx = createContext<NavState>({ open: false, setOpen: () => {} });

/** Shares the mobile drawer's open/close state between the top bar (the ☰
 * button) and the Sidebar (the drawer itself). Renders no DOM of its own, so
 * the .app-shell flex layout is preserved. */
export function NavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <NavCtx.Provider value={{ open, setOpen }}>{children}</NavCtx.Provider>;
}

export const useNav = () => useContext(NavCtx);
