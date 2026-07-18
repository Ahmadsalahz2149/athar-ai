"use client";

import { useState } from "react";

/** Password field with a show/hide toggle (reduces entry errors, esp. in RTL). */
export function PasswordInput({
  value,
  onChange,
  showLabel,
  hideLabel,
  minLength = 6,
  required = true,
}: {
  value: string;
  onChange: (v: string) => void;
  showLabel: string;
  hideLabel: string;
  minLength?: number;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 46,
          padding: "0 44px 0 14px",
          borderRadius: 12,
          border: "1px solid var(--border-2)",
          background: "var(--card)",
          fontSize: 14.5,
          outline: "none",
          direction: "ltr",
          textAlign: "start",
        }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? hideLabel : showLabel}
        style={{ position: "absolute", insetInlineEnd: 10, insetBlockStart: 11, width: 26, height: 26, display: "grid", placeItems: "center", border: "none", background: "transparent", cursor: "pointer", color: "var(--subtle)" }}
      >
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.2A9.5 9.5 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3 3.6M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.5 9.5 0 0 0 3.4-.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" /></svg>
        )}
      </button>
    </div>
  );
}

/** 0–3 strength meter for a new password. */
export function strength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(3, s);
}
