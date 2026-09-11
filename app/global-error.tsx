"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary for errors in the root layout itself (INFRA phase 5).
 * Must render its own <html>/<body>. Self-contained styles — nothing external
 * is guaranteed to be available at this point.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // An error that reaches here has taken the whole app down for this visitor,
  // so it is the single most important one to hear about — and being
  // client-side, nothing on the server sees it unless this reports it.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F8F5EF", color: "#1F2937" }}>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "110px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>حدث خطأ غير متوقّع · Something went wrong</h1>
          <p style={{ color: "#5B6B7B", lineHeight: 1.8, margin: "12px 0 24px" }}>
            تعذّر تحميل التطبيق. حاول إعادة التحميل. · The app failed to load. Please try again.
          </p>
          <button onClick={reset} style={{ height: 46, padding: "0 24px", borderRadius: 12, border: "none", cursor: "pointer", background: "#1F2937", color: "#fff", fontWeight: 700, fontSize: 15 }}>
            إعادة المحاولة · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
