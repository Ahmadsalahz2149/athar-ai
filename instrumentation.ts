import * as Sentry from "@sentry/nextjs";

/**
 * Next 16 instrumentation hook: `register` runs once per server instance, and
 * `onRequestError` receives every server-side error Next captures — including
 * the ones that previously vanished silently in route handlers and Server
 * Components.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

export const onRequestError = Sentry.captureRequestError;
