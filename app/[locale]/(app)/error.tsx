"use client";

import { usePathname } from "next/navigation";

/**
 * Segment error boundary (INFRA phase 5). Catches render/runtime errors in any
 * app screen and shows a recoverable UI instead of a blank crash. Strings are
 * inlined bilingual (not next-intl) so an i18n failure can't break the boundary
 * itself. `reset()` re-renders the segment.
 */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  const ar = !pathname || pathname.startsWith("/ar");
  const T = ar
    ? { title: "حدث خطأ غير متوقّع", body: "تعذّر عرض هذه الشاشة. يمكنك المحاولة مجددًا أو العودة للوحة.", retry: "إعادة المحاولة", home: "لوحة التحكّم" }
    : { title: "Something went wrong", body: "This screen failed to render. Try again or head back to the dashboard.", retry: "Try again", home: "Dashboard" };
  const home = ar ? "/ar/dashboard" : "/en/dashboard";

  return (
    <main dir={ar ? "rtl" : "ltr"} style={{ maxWidth: 520, margin: "0 auto", padding: "clamp(48px,10vw,110px) 24px", textAlign: "center" }}>
      <div style={{ width: 60, height: 60, margin: "0 auto 18px", borderRadius: 16, display: "grid", placeItems: "center", background: "var(--coral-tint)", color: "var(--coral)" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16.5v.5M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--heading)" }}>{T.title}</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.8, marginBlock: "10px 22px", fontSize: 14.5 }}>{T.body}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={reset} style={{ height: 46, padding: "0 22px", borderRadius: 12, border: "none", cursor: "pointer", background: "linear-gradient(135deg,var(--navy-2),var(--navy))", color: "#fff", fontWeight: 700, fontSize: 14.5 }}>{T.retry}</button>
        <a href={home} style={{ height: 46, padding: "0 22px", borderRadius: 12, display: "inline-grid", placeItems: "center", border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--slate)", fontWeight: 600, fontSize: 14.5, textDecoration: "none" }}>{T.home}</a>
      </div>
    </main>
  );
}
