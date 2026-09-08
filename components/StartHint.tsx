import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/**
 * Prominent-but-tasteful "do this first" guidance for new users on screens that
 * need a prerequisite (e.g. Content DNA before writing). Presentational + server-
 * safe, so client and server components can both render it. Show it only while
 * the prerequisite is missing — it disappears once the user is set up.
 */
export function StartHint({ eyebrow, title, body, cta, href, icon }: {
  eyebrow?: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  icon?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderInlineStart: "3px solid var(--teal)",
        borderRadius: 14,
        padding: "16px 18px",
        marginBlockEnd: 18,
      }}
    >
      <span style={{ flexShrink: 0, display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, background: "var(--teal-tint)", color: "var(--teal-deep)" }}>
        {icon ?? (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 21v-4M3 12h4M21 12h-4M5.6 5.6l2.8 2.8M18.4 18.4l-2.8-2.8M18.4 5.6l-2.8 2.8M5.6 18.4l2.8-2.8" /></svg>
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && <div className="mono-label" style={{ color: "var(--teal-deep)", marginBlockEnd: 4 }}>{eyebrow}</div>}
        <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--heading)", lineHeight: 1.5 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.7, marginBlockStart: 4 }}>{body}</div>
        <Link
          href={href}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 38, marginBlockStart: 12, padding: "0 18px", borderRadius: 10, background: "var(--teal)", color: "#fff", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
