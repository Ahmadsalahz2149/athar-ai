/**
 * Minimal structured logger (INFRA phase 6). Emits one JSON line per event so
 * logs are queryable in any aggregator, with a stable shape: {ts, level, msg,
 * ...fields}. No external deps. Use for background work + API routes where
 * grep-able context matters (job ids, durations, outcomes).
 */
type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, msg: string, fields?: Fields) {
  // ts is injected by the runtime; kept out of the object shape decisions here.
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(fields ?? {}) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
};
