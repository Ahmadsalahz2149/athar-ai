"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useNav } from "./nav-context";
import { signOut } from "@/lib/auth/actions";

export function AppTopBar({ userEmail }: { userEmail?: string }) {
  const nav = useTranslations("Nav");
  const tAuth = useTranslations("Auth");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const other = locale === "ar" ? "en" : "ar";
  const { setOpen } = useNav();
  const [menu, setMenu] = useState<null | "notif" | "account">(null);
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const initial = (userEmail?.[0] ?? "A").toUpperCase();
  const displayName = userEmail?.split("@")[0] ?? nav("account");

  return (
    <header
      className="glass-bar"
      style={{
        height: 64,
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "0 clamp(12px,4vw,32px)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        insetBlockStart: 0,
        zIndex: 20,
      }}
    >
      {menu && (
        <div onClick={() => setMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 30 }} aria-hidden />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" className="mobile-only nav-burger" onClick={() => setOpen(true)} aria-label={nav("menu")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <Link href="/studio" style={createBtn}>✦ {nav("createPost")}</Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <form
          className="desktop-only"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) router.push("/vault");
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={nav("search")}
            style={{ width: 190, height: 38, padding: "0 14px", borderRadius: 999, border: "1px solid var(--border-2)", background: "var(--card)", fontSize: 13.5, outline: "none" }}
          />
        </form>

        {/* Notifications */}
        <div style={{ position: "relative", zIndex: 31 }}>
          <button onClick={() => setMenu(menu === "notif" ? null : "notif")} aria-label={nav("notifications")} style={iconBtn}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 21a2 2 0 0 0 4 0" stroke="var(--navy)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {menu === "notif" && (
            <div style={dropdown}>
              <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 13.5, marginBlockEnd: 8 }}>{nav("notifications")}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", padding: "14px 4px", textAlign: "center" }}>{nav("noNotifications")}</div>
            </div>
          )}
        </div>

        <Link href={pathname} locale={other} style={langBtn(other)}>{nav("switchTo")}</Link>

        {/* Account chip: avatar + name + sub-line (design parity) */}
        <div style={{ position: "relative", zIndex: 31 }}>
          <button
            onClick={() => setMenu(menu === "account" ? null : "account")}
            aria-label={nav("account")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              height: 42,
              padding: "0 6px 0 10px",
              borderRadius: 999,
              border: "1px solid var(--border-2)",
              background: "var(--card)",
              cursor: "pointer",
            }}
          >
            <span style={{ width: 32, height: 32, flex: "none", borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(135deg,var(--navy-2),var(--navy))", color: "#fff", fontWeight: 700, fontSize: 13 }}>
              {initial}
            </span>
            <span className="desktop-only" style={{ textAlign: "start", lineHeight: 1.25 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--heading)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</span>
              <span style={{ display: "block", fontSize: 10.5, color: "var(--muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail ?? ""}</span>
            </span>
          </button>
          {menu === "account" && (
            <div style={{ ...dropdown, insetInlineEnd: 0 }}>
              {userEmail && <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "2px 6px 10px", borderBottom: "1px solid var(--border)", overflow: "hidden", textOverflow: "ellipsis" }}>{userEmail}</div>}
              <Link href="/settings" onClick={() => setMenu(null)} style={menuItem}>{nav("settings")}</Link>
              <button onClick={() => start(() => signOut(locale))} disabled={pending} style={{ ...menuItem, width: "100%", textAlign: "start", border: "none", background: "transparent", cursor: "pointer", color: "var(--coral)" }}>
                {tAuth("signOut")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const createBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  height: 40,
  padding: "0 16px",
  borderRadius: 11,
  background: "linear-gradient(135deg,#102A43,#0B1F33)",
  color: "#fff",
  fontSize: 13.5,
  fontWeight: 700,
  boxShadow: "0 10px 22px -12px rgba(11,31,51,.7)",
};
const iconBtn: React.CSSProperties = {
  width: 38,
  height: 38,
  display: "grid",
  placeItems: "center",
  borderRadius: 11,
  border: "1px solid var(--border-2)",
  background: "var(--card)",
  cursor: "pointer",
};
const langBtn = (other: string): React.CSSProperties => ({
  color: "var(--navy)",
  border: "1px solid var(--border-2)",
  borderRadius: 999,
  padding: "6px 14px",
  background: "var(--card)",
  fontSize: 13.5,
  fontWeight: 600,
  fontFamily: other === "en" ? "var(--font-latin)" : "var(--font-ar)",
});
const dropdown: React.CSSProperties = {
  position: "absolute",
  insetBlockStart: "calc(100% + 8px)",
  insetInlineEnd: 0,
  width: 240,
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 10,
  boxShadow: "0 24px 50px -18px rgba(11,31,51,.35)",
};
const menuItem: React.CSSProperties = {
  display: "block",
  padding: "10px 8px",
  borderRadius: 9,
  fontSize: 13.5,
  fontWeight: 600,
  color: "var(--slate)",
};
