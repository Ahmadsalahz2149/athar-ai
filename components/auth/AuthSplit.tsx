import type { ReactNode } from "react";

/**
 * Two-column full-bleed auth layout from the prototype: form panel on the
 * inline-start side, navy brand panel on the inline-end side, with the faint
 * concentric-ripple motif. Collapses to a single column on phones.
 */
export function AuthSplit({ children, panel }: { children: ReactNode; panel: ReactNode }) {
  return (
    <div className="auth-split">
      <section className="auth-form-pane">
        <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
      </section>

      <aside className="auth-brand-pane">
        <svg
          aria-hidden
          viewBox="0 0 400 400"
          style={{ position: "absolute", insetBlockStart: -60, insetInlineStart: -80, width: 460, height: 460, opacity: 0.5 }}
        >
          {[70, 120, 170, 220].map((r) => (
            <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="rgba(94,234,212,.13)" strokeWidth="1.5" />
          ))}
        </svg>
        <div style={{ position: "relative", width: "100%", maxWidth: 460 }}>{panel}</div>
      </aside>
    </div>
  );
}
