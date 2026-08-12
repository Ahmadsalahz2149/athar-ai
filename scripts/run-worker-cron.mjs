import fs from "node:fs";
import path from "node:path";

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}

const envFile = process.env.ATHAR_ENV_FILE || path.resolve(process.cwd(), ".env.production");
const fileEnv = parseEnv(envFile);
const secret = process.env.WORKER_SECRET || fileEnv.WORKER_SECRET;
const baseUrl = process.env.OAUTH_BASE_URL || fileEnv.OAUTH_BASE_URL || "https://athargrowth.com";

if (!secret) throw new Error("WORKER_SECRET is missing; refusing to call the worker without authentication.");

const response = await fetch(new URL("/api/worker", baseUrl), {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
  // Large free-tier embedding jobs are intentionally rate-limited and can take
  // several minutes. The cron uses flock, so this longer request cannot overlap.
  signal: AbortSignal.timeout(10 * 60_000),
});

const payload = await response.text();
if (!response.ok) throw new Error(`Worker returned HTTP ${response.status}: ${payload.slice(0, 300)}`);

const result = JSON.parse(payload);
if (result.processed || result.reaped) {
  console.log(`${new Date().toISOString()} worker processed=${result.processed ?? 0} reaped=${result.reaped ?? 0}`);
}
