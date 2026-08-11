/** Brand mark — a burgundy rounded square with the Arabic "أ", matching the
 * reference's compact "CS" logo tile. Uses the accent token so it tracks the
 * theme's burgundy. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        background: "var(--teal)",
        borderRadius: 9,
        flex: "none",
        color: "#fff",
        fontWeight: 800,
        fontSize: size * 0.5,
        fontFamily: "var(--font-ar)",
        lineHeight: 1,
      }}
      aria-hidden
    >
      أ
    </div>
  );
}

export function BrandWord({ name, ai, tagline }: { name: string; ai: string; tagline?: string }) {
  return (
    <div style={{ lineHeight: 1.2 }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--heading)" }}>
        {name}
        <span style={{ color: "var(--teal-deep)" }}> {ai}</span>
      </div>
      {tagline ? (
        <div className="mono-label" style={{ fontSize: 10, color: "var(--subtle)", marginBlockStart: 1 }}>
          {tagline}
        </div>
      ) : null}
    </div>
  );
}
