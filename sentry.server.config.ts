import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error reporting. Sentry is OPT-IN: with no DSN configured this
 * file initialises nothing, so a deployment without SENTRY_DSN behaves exactly
 * as it did before observability was added.
 *
 * `sendDefaultPii` stays false on purpose — this app handles customer content
 * and emails, and none of that should leave for a third party with a stack
 * trace attached.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    // Tie every event to the commit it came from (same value /api/health reports).
    release: process.env.ATHAR_COMMIT,
    // Tracing is off by default: it multiplies event volume and cost. Raise it
    // deliberately (e.g. 0.1) once errors are under control.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    sendDefaultPii: false,
  });
}
