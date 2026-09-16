import type { ReactNode } from "react";

/**
 * A form field whose label is actually attached to its control.
 *
 * Three screens had grown their own `Field`, and all three rendered the label
 * as a `<div>` — visually a label, programmatically nothing. `htmlFor` appeared
 * nowhere in the codebase, so no input in the product announced itself to a
 * screen reader: they all read as an unnamed text box.
 *
 * The fix is a real `<label>` WRAPPING the control. That is an implicit
 * association: no id to generate, none to collide, and it cannot come undone
 * later the way a matching id pair can when someone copies the markup.
 *
 * One control per Field — that is what the implicit association allows, and it
 * is the only shape any caller here needs.
 */
export function Field({
  label,
  hint,
  children,
  block = true,
}: {
  label: string;
  /** Shown under the label, e.g. "one per line". Part of the label element, so
   * it is announced with the field rather than floating loose beside it. */
  hint?: string;
  children: ReactNode;
  /** Set false inside a row that manages its own spacing. */
  block?: boolean;
}) {
  return (
    <label style={{ display: "block", marginBlockStart: block ? 14 : 0 }}>
      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--slate)", marginBlockEnd: 7 }}>
        {label}
        {hint && (
          <span style={{ fontWeight: 400, color: "var(--muted)", marginInlineStart: 6, fontSize: 12 }}>
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
