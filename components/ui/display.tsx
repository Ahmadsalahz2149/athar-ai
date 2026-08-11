import type { CSSProperties, ReactNode } from "react";

/**
 * Shared design primitives extracted from the prototype screenshots.
 * Presentational only (no hooks) so BOTH server and client components can use
 * them. Interactive props (onClick) are supplied by client parents.
 */

/* ---------------- StatusPill ---------------- */
export type PillTone = "teal" | "amber" | "red" | "neutral" | "blue" | "gold";

const PILL: Record<PillTone, CSSProperties> = {
  teal: { background: "var(--teal-tint-2)", color: "var(--teal-deep)", borderColor: "color-mix(in srgb, var(--teal) 32%, transparent)" },
  amber: { background: "var(--gold-tint)", color: "var(--gold-dark)", borderColor: "color-mix(in srgb, var(--gold) 35%, transparent)" },
  red: { background: "var(--coral-tint)", color: "var(--coral)", borderColor: "color-mix(in srgb, var(--coral) 32%, transparent)" },
  neutral: { background: "var(--border-3)", color: "var(--slate-2)", borderColor: "var(--border-2)" },
  blue: { background: "var(--blue-tint)", color: "var(--blue)", borderColor: "color-mix(in srgb, var(--blue) 30%, transparent)" },
  gold: { background: "var(--gold-tint)", color: "var(--gold-dark)", borderColor: "color-mix(in srgb, var(--gold) 35%, transparent)" },
};

export function StatusPill({ tone = "teal", children, dot }: { tone?: PillTone; children: ReactNode; dot?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11.5,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid",
        whiteSpace: "nowrap",
        ...PILL[tone],
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />}
      {children}
    </span>
  );
}

/* ---------------- FileTypeBadge ---------------- */
const FILE_TINT: Record<string, { bg: string; fg: string }> = {
  PDF: { bg: "var(--coral-tint)", fg: "var(--coral)" },
  MP4: { bg: "var(--blue-tint)", fg: "var(--blue)" },
  MP3: { bg: "var(--teal-tint)", fg: "var(--teal-deep)" },
  TXT: { bg: "var(--border-3)", fg: "var(--slate-2)" },
  URL: { bg: "var(--gold-tint)", fg: "var(--gold-dark)" },
  DOCX: { bg: "var(--blue-tint)", fg: "var(--blue)" },
};

/** Maps our stored source.kind → the prototype's badge label. */
export function kindToLabel(kind: string, title?: string | null): string {
  const ext = (title ?? "").split(".").pop()?.toUpperCase() ?? "";
  if (ext && FILE_TINT[ext]) return ext;
  switch (kind) {
    case "audio":
      return "MP3";
    case "video":
      return "MP4";
    case "pdf":
      return "PDF";
    case "url":
      return "URL";
    default:
      return "TXT";
  }
}

export function FileTypeBadge({ label, size = 34 }: { label: string; size?: number }) {
  const t = FILE_TINT[label] ?? FILE_TINT.TXT;
  return (
    <span
      style={{
        display: "grid",
        placeItems: "center",
        width: size,
        height: size,
        flex: "none",
        borderRadius: 9,
        background: t.bg,
        color: t.fg,
        fontSize: 10.5,
        fontWeight: 800,
        fontFamily: "var(--font-latin)",
      }}
    >
      {label}
    </span>
  );
}

/* ---------------- ScoreRadial ---------------- */
export function ScoreRadial({
  value,
  size = 92,
  color = "var(--teal)",
  track = "var(--border-2)",
  caption,
  suffix = "",
  valueColor = "var(--heading)",
  label,
}: {
  value: number;
  size?: number;
  color?: string;
  track?: string;
  caption?: string;
  suffix?: string;
  valueColor?: string;
  label?: string;
}) {
  const stroke = size >= 80 ? 8 : 6;
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const off = c - (pct / 100) * c;
  const mid = size / 2;
  const aria = label
    ? { role: "meter" as const, "aria-label": label, "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuetext": `${value}${suffix}` }
    : {};
  return (
    <div style={{ display: "grid", placeItems: "center", gap: 4 }} {...aria}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden={label ? true : undefined}>
        <circle cx={mid} cy={mid} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform={`rotate(-90 ${mid} ${mid})`}
        />
        <text
          x={mid}
          y={mid + size * 0.07}
          textAnchor="middle"
          fontSize={size * 0.24}
          fontWeight="800"
          fill={valueColor}
          fontFamily="var(--font-latin)"
        >
          {value}
          {suffix}
        </text>
      </svg>
      {caption && <span style={{ fontSize: 12, color: "var(--muted)" }}>{caption}</span>}
    </div>
  );
}

/* ---------------- ProgressMeter ---------------- */
export function ProgressMeter({
  pct,
  color = "linear-gradient(90deg,var(--teal),var(--teal-dark))",
  height = 8,
  track = "var(--border-3)",
  label,
}: {
  pct: number;
  color?: string;
  height?: number;
  track?: string;
  label?: string;
}) {
  return (
    <div
      style={{ height, borderRadius: height, background: track, overflow: "hidden" }}
      {...(label ? { role: "meter", "aria-label": label, "aria-valuenow": Math.round(pct), "aria-valuemin": 0, "aria-valuemax": 100 } : {})}
    >
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color }} />
    </div>
  );
}

/* ---------------- SegmentMeter (3 segments) ---------------- */
export function SegmentMeter({
  filled,
  total = 3,
  color = "var(--teal)",
  label,
}: {
  filled: number;
  total?: number;
  color?: string;
  label?: string;
}) {
  return (
    <div
      style={{ display: "flex", gap: 5 }}
      {...(label ? { role: "meter", "aria-label": label, "aria-valuenow": filled, "aria-valuemin": 0, "aria-valuemax": total } : {})}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            width: 26,
            height: 6,
            borderRadius: 6,
            background: i < filled ? color : "var(--border-2)",
          }}
        />
      ))}
    </div>
  );
}

/* ---------------- CountBadge ---------------- */
export function CountBadge({ n, tone = "amber" }: { n: ReactNode; tone?: "amber" | "teal" }) {
  const bg = tone === "amber" ? "var(--gold)" : "var(--teal)";
  return (
    <span
      style={{
        minWidth: 20,
        height: 20,
        padding: "0 6px",
        display: "inline-grid",
        placeItems: "center",
        borderRadius: 999,
        background: bg,
        color: "#fff",
        fontSize: 11,
        fontWeight: 800,
        fontFamily: "var(--font-latin)",
      }}
    >
      {n}
    </span>
  );
}

/* ---------------- IconTile ---------------- */
export function IconTile({
  children,
  tint = "var(--teal-tint)",
  size = 38,
  radius = 11,
}: {
  children: ReactNode;
  tint?: string;
  size?: number;
  radius?: number;
}) {
  return (
    <span style={{ display: "grid", placeItems: "center", width: size, height: size, flex: "none", borderRadius: radius, background: tint, fontSize: size * 0.45 }}>
      {children}
    </span>
  );
}

/* ---------------- StatCard ---------------- */
export function StatCard({
  label,
  value,
  delta,
  deltaNegative,
  icon,
  tint,
  note,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaNegative?: boolean;
  icon?: ReactNode;
  tint?: string;
  note?: string;
}) {
  return (
    <div className="lift" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBlockEnd: 10 }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{label}</span>
        {icon && <IconTile tint={tint ?? "var(--teal-tint)"} size={32} radius={9}>{icon}</IconTile>}
      </div>
      <div style={{ fontSize: 25, fontWeight: 800, color: "var(--heading)", fontFamily: "var(--font-latin)" }}>{value}</div>
      {delta && (
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBlockStart: 4, color: deltaNegative ? "var(--coral)" : "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>
          {delta}
        </div>
      )}
      {note && <div style={{ fontSize: 12, fontWeight: 600, marginBlockStart: 4, color: "var(--coral)" }}>{note}</div>}
    </div>
  );
}

/* ---------------- DarkCard ---------------- */
export function DarkCard({
  eyebrow,
  children,
  style,
}: {
  eyebrow?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ background: "linear-gradient(160deg,var(--navy-2),var(--navy))", color: "#fff", borderRadius: 12, padding: 20, ...style }}>
      {eyebrow && <div style={{ fontSize: 12.5, color: "var(--teal-light)", fontWeight: 700, marginBlockEnd: 8 }}>{eyebrow}</div>}
      {children}
    </div>
  );
}

/* ---------------- NumberedStepper ---------------- */
export function NumberedStepper({ steps }: { steps: { title: string; desc: string }[] }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span
              style={{
                width: 26,
                height: 26,
                flex: "none",
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                background: last ? "var(--gold)" : "rgba(15, 118, 110,.9)",
                color: last ? "#3a2b0c" : "#04211d",
                fontWeight: 800,
                fontSize: 13,
                fontFamily: "var(--font-latin)",
              }}
            >
              {i + 1}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.title}</div>
              <div style={{ fontSize: 12.5, color: "#9FB3C8", lineHeight: 1.6, marginBlockStart: 2 }}>{s.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- EmptyState ---------------- */
export function EmptyState({ title, body, cta }: { title: string; body?: string; cta?: ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "34px 20px", border: "1px dashed var(--border-2)", borderRadius: 12, background: "var(--surface)" }}>
      <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 16 }}>{title}</div>
      {body && <div style={{ color: "var(--muted)", marginBlock: "8px 16px", lineHeight: 1.7 }}>{body}</div>}
      {cta}
    </div>
  );
}

/* ---------------- PlatformBadge ---------------- */
const PLATFORM: Record<string, { bg: string; fg: string; glyph: string }> = {
  LinkedIn: { bg: "var(--blue-tint)", fg: "var(--blue)", glyph: "in" },
  "X / Twitter": { bg: "#EEE", fg: "#111", glyph: "X" },
  X: { bg: "#EEE", fg: "#111", glyph: "X" },
  Instagram: { bg: "var(--gold-tint)", fg: "#C2410C", glyph: "ig" },
  TikTok: { bg: "#EEE", fg: "#111", glyph: "TT" },
};

export function platformColor(p: string): string {
  return p === "LinkedIn" ? "var(--blue)" : p.startsWith("X") ? "#111" : "var(--gold)";
}

export function PlatformBadge({ platform, size = 34 }: { platform: string; size?: number }) {
  const p = PLATFORM[platform] ?? PLATFORM.LinkedIn;
  return (
    <span
      style={{
        display: "grid",
        placeItems: "center",
        width: size,
        height: size,
        flex: "none",
        borderRadius: 9,
        background: p.bg,
        color: p.fg,
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "var(--font-latin)",
      }}
    >
      {p.glyph}
    </span>
  );
}

/* ---------------- Chip (selectable) ----------------
 * Two selected looks exist in the prototype:
 *  - "fill"    → solid navy (used for single-select groups: platform, format, filters)
 *  - "outline" → teal outline + mint tint (used for multi-select / onboarding chips)
 */
export function Chip({
  children,
  active,
  onClick,
  variant = "outline",
  size = "md",
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  variant?: "fill" | "outline";
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "7px 14px" : "9px 16px";
  const base: CSSProperties = {
    padding: pad,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    cursor: onClick ? "pointer" : "default",
    whiteSpace: "nowrap",
    transition: "background .12s, border-color .12s",
  };
  const style: CSSProperties = active
    ? variant === "fill"
      ? { ...base, background: "var(--teal)", color: "#fff", border: "1.5px solid var(--teal)" }
      : { ...base, background: "var(--teal-tint-2)", color: "var(--teal-deep)", border: "1.5px solid var(--teal)" }
    : { ...base, background: "var(--card)", color: "var(--slate)", border: "1px solid var(--border-2)" };
  return (
    <button type="button" onClick={onClick} aria-pressed={!!active} style={style}>
      {children}
    </button>
  );
}

/* ---------------- Skeleton ---------------- */
/* ---------------- GlyphIcon (SVG, replaces emoji-as-icons) ----------------
   Emoji render differently per-OS and ignore brand color — a design anti-pattern.
   These are consistent, currentColor-driven Lucide-style line icons. */
const GLYPH_PATHS: Record<string, string> = {
  book: "M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 3v18",
  bookOpen: "M12 7v13M12 7a4 4 0 0 0-4-4H3v14h5a4 4 0 0 1 4 4M12 7a4 4 0 0 1 4-4h5v14h-5a4 4 0 0 0-4 4",
  trophy: "M8 4h8v4a4 4 0 0 1-8 0zM8 6H5a2 2 0 0 0 2 3M16 6h3a2 2 0 0 1-2 3M9 15h6l1 5H8z",
  briefcase: "M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 12h16",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c.7.7 1 1.3 1 2h6c0-.7.3-1.3 1-2a6 6 0 0 0-4-10z",
  message: "M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  chart: "M4 20V10M10 20V4M16 20v-7M20 20H3",
  flame: "M12 3c1 3-1 4-1 6a3 3 0 0 0 6 0c0-1-.5-2-1-3 2 1 3 3.5 3 6a6 6 0 0 1-12 0c0-3 2-4 3-6 .5 1 2 1 2-3z",
  warn: "M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17v.5",
};
export function GlyphIcon({ name, size = 18, color = "currentColor", strokeWidth = 1.7 }: { name: keyof typeof GLYPH_PATHS | string; size?: number; color?: string; strokeWidth?: number }) {
  const d = GLYPH_PATHS[name] ?? GLYPH_PATHS.bulb;
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Skeleton({ h = 16, w = "100%", r = 10, style }: { h?: number | string; w?: number | string; r?: number; style?: CSSProperties }) {
  return <span className="skeleton" aria-hidden style={{ display: "block", height: h, width: w, borderRadius: r, ...style }} />;
}

/** A generic page-loading fallback: a title line + a grid of card blocks.
 * Used by route-level loading.tsx files so navigation feels instant. */
export function PageSkeleton({ cards = 6, minColW = 280 }: { cards?: number; minColW?: number }) {
  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px" }} aria-busy="true">
      <Skeleton h={28} w={220} />
      <div style={{ marginBlockStart: 8 }}><Skeleton h={16} w={300} /></div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${minColW}px,1fr))`, gap: 16, marginBlockStart: 22 }}>
        {Array.from({ length: cards }, (_, i) => <Skeleton key={i} h={150} r={16} />)}
      </div>
    </main>
  );
}

/* ---------------- SelectableCard (with check circle) ---------------- */
export function SelectableCard({
  title,
  desc,
  active,
  onClick,
}: {
  title: string;
  desc?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className="lift"
      style={{
        textAlign: "start",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        width: "100%",
        padding: "14px 16px",
        borderRadius: 12,
        cursor: onClick ? "pointer" : "default",
        background: active ? "var(--teal-tint-2)" : "var(--card)",
        border: active ? "1.5px solid var(--teal)" : "1.5px solid var(--border-2)",
      }}
    >
      <span>
        <span style={{ display: "block", fontWeight: 700, color: "var(--heading)", fontSize: 14.5 }}>{title}</span>
        {desc && <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginBlockStart: 3 }}>{desc}</span>}
      </span>
      <span
        style={{
          width: 22,
          height: 22,
          flex: "none",
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: active ? "var(--teal)" : "transparent",
          border: active ? "none" : "1.5px solid var(--border-2)",
        }}
      >
        {active && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}

/* ---------------- Buttons (shared styles) ---------------- */
export const btnNavy: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  height: 36,
  padding: "0 16px",
  borderRadius: 9,
  border: "none",
  background: "var(--teal)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13.5,
  cursor: "pointer",
};
export const btnTeal: CSSProperties = { ...btnNavy, background: "var(--teal)" };
export const btnGhost: CSSProperties = {
  ...btnNavy,
  background: "transparent",
  border: "1px solid var(--border-2)",
  color: "var(--text)",
};
export const btnGold: CSSProperties = { ...btnNavy, background: "var(--gold)", color: "#241a06" };
