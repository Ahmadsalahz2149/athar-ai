"use client";

/**
 * Last-resort boundary for errors in the root layout itself (INFRA phase 5).
 * Must render its own <html>/<body>. Self-contained styles — nothing external
 * is guaranteed to be available at this point.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F8F5EF", color: "#0B1F33" }}>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "110px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>حدث خطأ غير متوقّع · Something went wrong</h1>
          <p style={{ color: "#5B6B7B", lineHeight: 1.8, margin: "12px 0 24px" }}>
            تعذّر تحميل التطبيق. حاول إعادة التحميل. · The app failed to load. Please try again.
          </p>
          <button onClick={reset} style={{ height: 46, padding: "0 24px", borderRadius: 12, border: "none", cursor: "pointer", background: "#0B1F33", color: "#fff", fontWeight: 700, fontSize: 15 }}>
            إعادة المحاولة · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
