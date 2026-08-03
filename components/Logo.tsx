export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(150deg,#102A43,#0B1F33)",
        borderRadius: 12,
        boxShadow: "0 8px 18px -8px rgba(11,31,51,.6)",
        flex: "none",
      }}
      aria-hidden
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="2.4" fill="#D6A84F" />
        <circle cx="12" cy="12" r="6" stroke="#14B8A6" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="9.6" stroke="#14B8A6" strokeWidth="1.4" opacity=".4" />
      </svg>
    </div>
  );
}

export function BrandWord({ name, ai, tagline }: { name: string; ai: string; tagline?: string }) {
  return (
    <div style={{ lineHeight: 1.15 }}>
      <div style={{ fontWeight: 700, fontSize: 18, color: "var(--navy)" }}>
        {name}
        <span style={{ color: "var(--teal-deep)" }}> {ai}</span>
      </div>
      {tagline ? (
        <div
          style={{
            fontSize: 10.5,
            color: "var(--subtle)",
            fontFamily: "var(--font-latin)",
            letterSpacing: ".3px",
          }}
        >
          {tagline}
        </div>
      ) : null}
    </div>
  );
}
