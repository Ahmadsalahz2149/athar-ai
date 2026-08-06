"use client";

import { recordClick } from "./actions";

/** Renders the link buttons and fires a best-effort click beacon before opening
 * each link (so the owner gets click stats). */
export function LinkList({ orgId, brandId, links }: { orgId: string; brandId: string; links: { label: string; url: string }[] }) {
  if (!links.length) return null;
  return (
    <div style={{ display: "grid", gap: 12, marginBlockStart: 26 }}>
      {links.map((l, i) => (
        <a
          key={i}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => { recordClick(orgId, brandId, i).catch(() => {}); }}
          style={{
            display: "block", padding: "15px 18px", borderRadius: 14, textAlign: "center",
            background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)",
            color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none",
            transition: "background .15s ease, transform .15s ease",
          }}
          className="lift"
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}
