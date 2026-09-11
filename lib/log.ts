import * as Sentry from "@sentry/nextjs";

/**
 * Minimal structured logger (INFRA phase 6). Emits one JSON line per event so
 * logs are queryable in any aggregator, with a stable shape: {ts, level, msg,
 * ...fields}. Use for background work + API routes where grep-able context
 * matters (job ids, durations, outcomes).
 *
 * `error` additionally reports to Sentry. That is what turns a failure which
 * only ever reached the server's stdout — where nobody was watching — into
 * something that actually notifies. Sentry is inert without a DSN, so this
 * stays a plain console logger until one is configured.
 */
type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, msg: string, fields?: Fields, err?: unknown) {
  // ts is injected by the runtime; kept out of the object shape decisions here.
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(fields ?? {}) });
  if (level === "error") {
    console.error(line);
    // Prefer the real Error (keeps the stack); fall back to the message.
    if (err !== undefined) Sentry.captureException(err, { extra: { msg, ...(fields ?? {}) } });
    else Sentry.captureMessage(msg, { level: "error", extra: fields });
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  /** Pass the caught value as `err` so Sentry keeps the original stack trace. */
  error: (msg: string, fields?: Fields, err?: unknown) => emit("error", msg, fields, err),
};
